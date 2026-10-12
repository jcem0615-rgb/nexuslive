'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Avatar, DiamondIcon, LiveBadge } from '@/components/ui';
import { CHAT_MESSAGE_MAX_LENGTH, GIFT_BEAN_RATE } from '@/lib/economy';
import { compact } from '@/lib/format';

type Message = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
};

type GiftOption = {
  code: string;
  name: string;
  glyph: string;
  diamonds: number;
  tier: string;
  beans: number;
};

type Props = {
  stream: {
    id: string;
    title: string;
    category: string;
    viewerCount: number;
    beansEarned: number;
    startedAt: string;
    host: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      levelTitle: string;
    };
  };
  initialMessages: Message[];
  gifts: GiftOption[];
  viewer: {
    id: string;
    username: string;
    displayName: string;
    diamonds: number;
    isHost: boolean;
  } | null;
};

/** How often we pull new chat. Redis pub/sub is the planned replacement. */
const CHAT_POLL_MS = 4_000;

export function StreamRoom({ stream, initialMessages, gifts, viewer }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [diamonds, setDiamonds] = useState(viewer?.diamonds ?? 0);
  const [beansEarned, setBeansEarned] = useState(stream.beansEarned);
  const [trayOpen, setTrayOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<{ id: number; glyph: string }[]>([]);

  const feedRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(initialMessages.at(-1)?.createdAt ?? null);

  const merge = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const seen = new Set(current.map((m) => m.id));
      const added = incoming.filter((m) => !seen.has(m.id));
      if (added.length === 0) return current;
      lastAt.current = added.at(-1)?.createdAt ?? lastAt.current;
      return [...current, ...added].slice(-120);
    });
  }, []);

  // Poll for new chat. Chat is not cached anywhere — it comes off /api live.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const query = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : '';
        const data = await api<{ messages: Message[] }>(
          `/api/streams/${stream.id}/chat${query}`,
          { signal: controller.signal },
        );
        if (!cancelled) merge(data.messages);
      } catch {
        // A dropped poll is not worth shouting about; the next one retries.
      }
    };

    const timer = setInterval(tick, CHAT_POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [stream.id, merge]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer) return;

    const input = event.currentTarget.elements.namedItem('body') as HTMLInputElement;
    const body = input.value.trim();
    if (!body) return;
    input.value = '';

    try {
      const { message } = await api<{ message: Message }>(`/api/streams/${stream.id}/chat`, {
        method: 'POST',
        body: { body },
      });
      merge([message]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Message did not send');
    }
  }

  async function sendGift(gift: GiftOption) {
    if (!viewer) return;
    setSending(gift.code);
    setError(null);

    try {
      const result = await api<{ balance: number; beansCredited: number }>('/api/gifts/send', {
        method: 'POST',
        body: { giftCode: gift.code, receiverId: stream.host.id, streamId: stream.id, quantity: 1 },
      });
      setDiamonds(result.balance);
      setBeansEarned((current) => current + result.beansCredited);
      const floaterId = Date.now();
      setFloaters((current) => [...current, { id: floaterId, glyph: gift.glyph }]);
      // The float-up animation runs 1.6s; drop the node once it is done.
      window.setTimeout(
        () => setFloaters((current) => current.filter((f) => f.id !== floaterId)),
        1_800,
      );
      setTrayOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gift did not send');
    } finally {
      setSending(null);
    }
  }

  async function endStream() {
    await api(`/api/streams/${stream.id}/end`, { method: 'POST' }).catch(() => null);
    router.push('/live');
    router.refresh();
  }

  return (
    <main className="relative flex h-[100dvh] flex-col bg-ink-900">
      {/* Stage. Video lands here once LiveKit is wired in. */}
      <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-nexus-800/60 via-ink-800 to-ink-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <Avatar name={stream.host.displayName} src={stream.host.avatarUrl} size={96} ring />
          <p className="text-sm font-semibold text-slate-300">{stream.host.displayName}</p>
          <p className="max-w-xs text-xs text-slate-500">
            Video transport is not connected yet. Chat and gifting are live.
          </p>
        </div>

        <header className="absolute inset-x-0 top-0 flex items-start gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <Link href="/live" className="rounded-full bg-black/50 p-2 text-white" aria-label="Back">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{stream.title}</p>
            <Link href={`/u/${stream.host.username}`} className="truncate text-xs text-slate-300 hover:underline">
              @{stream.host.username} · {stream.host.levelTitle}
            </Link>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <LiveBadge viewers={stream.viewerCount} />
            <span className="pill bg-black/50 text-bean">{compact(beansEarned)} beans</span>
          </div>
        </header>

        {viewer?.isHost && (
          <button type="button" onClick={endStream} className="absolute bottom-3 right-3 btn-ghost text-xs">
            End stream
          </button>
        )}

        {/* Gift animations float up the stage. */}
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2">
          {floaters.map((floater) => (
            <span key={floater.id} className="absolute text-5xl animate-float-up">
              {floater.glyph}
            </span>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div ref={feedRef} className="h-48 overflow-y-auto px-3 py-2 no-scrollbar">
        <ul className="space-y-1.5">
          {messages.map((message) => (
            <li key={message.id} className="flex items-start gap-2 text-sm">
              <Avatar name={message.user.displayName} src={message.user.avatarUrl} size={22} />
              <p className="min-w-0">
                <span className="font-semibold text-nexus-300">{message.user.displayName}</span>{' '}
                <span className="text-slate-200">{message.body}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="px-3 pb-1 text-xs text-live">
          {error}
        </p>
      )}

      {/* Composer */}
      <div
        className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        {viewer ? (
          <>
            <form onSubmit={sendChat} className="flex-1">
              <input
                name="body"
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                className="input py-2"
                placeholder="Say something…"
                autoComplete="off"
              />
            </form>
            <span className="pill shrink-0 bg-diamond/15 text-diamond">
              <DiamondIcon />
              <span className="tabular-nums">{compact(diamonds)}</span>
            </span>
            <button
              type="button"
              onClick={() => setTrayOpen((open) => !open)}
              className="btn-live shrink-0 px-3 py-2"
              aria-expanded={trayOpen}
            >
              Gift
            </button>
          </>
        ) : (
          <Link href="/login" className="btn-primary w-full">
            Sign in to chat and gift
          </Link>
        )}
      </div>

      {/* Gift tray */}
      {trayOpen && viewer && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-white/10 bg-ink-800/95 p-4 backdrop-blur-lg"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Send a gift</h2>
            <button type="button" onClick={() => setTrayOpen(false)} className="text-xs text-slate-400">
              Close
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {gifts.map((gift) => {
              const affordable = diamonds >= gift.diamonds;
              return (
                <button
                  key={gift.code}
                  type="button"
                  onClick={() => sendGift(gift)}
                  disabled={!affordable || sending !== null}
                  className={`card flex flex-col items-center gap-1 p-2.5 transition ${
                    affordable ? 'hover:border-nexus-400/50' : 'opacity-40'
                  }`}
                  title={`${gift.name} — earns the host ${gift.beans} beans`}
                >
                  <span className="text-2xl">{gift.glyph}</span>
                  <span className="text-[10px] font-semibold text-slate-300">{gift.name}</span>
                  <span className="flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-diamond">
                    <DiamondIcon className="h-3 w-3" />
                    {gift.diamonds}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            The host keeps {Math.round(GIFT_BEAN_RATE * 100)}% of what you spend, as beans.
          </p>
        </div>
      )}
    </main>
  );
}
