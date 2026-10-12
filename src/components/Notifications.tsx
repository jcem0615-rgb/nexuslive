'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type Notification = {
  id: string;
  kind:
    | 'GIFT_RECEIVED'
    | 'NEW_FOLLOWER'
    | 'SEAT_INVITE'
    | 'SEAT_JOINED'
    | 'STRIKE_ISSUED'
    | 'CASHOUT_UPDATE'
    | 'SYSTEM';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

const SKIN: Record<Notification['kind'], { icon: string; accent: string; ring: string }> = {
  GIFT_RECEIVED: { icon: '🎁', accent: 'text-bean', ring: 'from-bean/60 via-amber-300/30 to-transparent' },
  NEW_FOLLOWER: { icon: '💜', accent: 'text-nexus-300', ring: 'from-nexus-400/60 via-nexus-500/20 to-transparent' },
  SEAT_INVITE: { icon: '🎤', accent: 'text-live', ring: 'from-live/60 via-pink-400/20 to-transparent' },
  SEAT_JOINED: { icon: '✨', accent: 'text-diamond', ring: 'from-diamond/60 via-sky-400/20 to-transparent' },
  STRIKE_ISSUED: { icon: '⚠️', accent: 'text-amber-300', ring: 'from-amber-400/60 via-amber-500/20 to-transparent' },
  CASHOUT_UPDATE: { icon: '💸', accent: 'text-emerald-300', ring: 'from-emerald-400/60 via-emerald-500/20 to-transparent' },
  SYSTEM: { icon: '🔔', accent: 'text-slate-200', ring: 'from-white/40 via-white/10 to-transparent' },
};

function linkFor(n: Notification): string | null {
  const data = n.data ?? {};
  if (typeof data.streamId === 'string') return `/live/${data.streamId}`;
  if (typeof data.fromUsername === 'string') return `/u/${data.fromUsername}`;
  if (typeof data.username === 'string') return `/u/${data.username}`;
  if (n.kind === 'CASHOUT_UPDATE') return '/wallet';
  return null;
}

const POLL_MS = 20_000;

/**
 * Bell, unread count, dropdown — and a toast stack that pops anything new
 * that arrives while the page is open.
 */
export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await api<{ notifications: Notification[]; unread: number }>(
        '/api/notifications?limit=20',
        { signal },
      );
      setItems(data.notifications);
      setUnread(data.unread);

      // The first load is the existing backlog, not news — pop toasts only for
      // what shows up after that.
      const fresh = data.notifications.filter((n) => !seen.current.has(n.id) && !n.readAt);
      data.notifications.forEach((n) => seen.current.add(n.id));
      if (primed.current && fresh.length) {
        setToasts((current) => [...current, ...fresh].slice(-3));
      }
      primed.current = true;
    } catch {
      // Silent: a missed poll retries on the next tick.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  async function markAllRead() {
    setUnread(0);
    setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await api('/api/notifications/read', { method: 'POST', body: {} }).catch(() => null);
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open && unread > 0) void markAllRead();
          }}
          className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm hover:bg-white/10"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          aria-expanded={open}
        >
          🔔
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            />
            <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl border border-white/10 bg-ink-800/95 shadow-glow backdrop-blur-lg">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {items.map((n) => {
                    const skin = SKIN[n.kind];
                    const href = linkFor(n);
                    const row = (
                      <div className="flex gap-3 px-4 py-3">
                        <span className="text-lg">{skin.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${skin.accent}`}>{n.title}</p>
                          {n.body && <p className="truncate text-xs text-slate-400">{n.body}</p>}
                          <p className="text-[11px] text-slate-600">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-live" />}
                      </div>
                    );
                    return (
                      <li key={n.id} className="hover:bg-white/5">
                        {href ? (
                          <Link href={href} onClick={() => setOpen(false)}>
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Notification[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-3"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: Notification; onDismiss: (id: string) => void }) {
  const skin = SKIN[toast.kind];
  const href = linkFor(toast);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 6_000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const inner = (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-ink-800/90 px-4 py-3 shadow-glow backdrop-blur-xl">
      {/* The luxury part: a slow sheen across the card. */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${skin.ring} opacity-70`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 animate-shimmer opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(110deg, transparent 20%, rgba(255,255,255,.55) 50%, transparent 80%)',
          backgroundSize: '200% 100%',
        }}
        aria-hidden
      />
      <div className="relative flex items-center gap-3">
        <span className="text-2xl drop-shadow">{skin.icon}</span>
        <div className="min-w-0">
          <p className={`truncate text-sm font-extrabold ${skin.accent}`}>{toast.title}</p>
          {toast.body && <p className="truncate text-xs text-slate-300">{toast.body}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pointer-events-auto w-full max-w-sm animate-toast-in">
      {href ? (
        <Link href={href} onClick={() => onDismiss(toast.id)}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={() => onDismiss(toast.id)} className="w-full text-left">
          {inner}
        </button>
      )}
    </div>
  );
}
