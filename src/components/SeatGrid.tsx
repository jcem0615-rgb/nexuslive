'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Avatar } from './ui';

export type Seat = {
  id: string;
  position: number;
  state: 'OPEN' | 'LOCKED' | 'INVITED' | 'OCCUPIED';
  mutedByHost: boolean;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
  invitedUser: { id: string; username: string; displayName: string } | null;
  isMine: boolean;
  invitedMe: boolean;
};

type Props = {
  streamId: string;
  isHost: boolean;
  signedIn: boolean;
  initialSeats: Seat[];
  /// Seats live here but the stage needs them too: taking a seat is what earns
  /// a viewer the camera, and that must not wait for a page reload.
  onSeatsChange?: (seats: Seat[]) => void;
};

/** How often seats re-sync. Redis pub/sub replaces this in Phase 10. */
const POLL_MS = 5_000;

export function SeatGrid({ streamId, isHost, signedIn, initialSeats, onSeatsChange }: Props) {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<number | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await api<{ seats: Seat[] }>(`/api/streams/${streamId}/seats`, { signal });
      setSeats(data.seats);
    } catch {
      // A dropped poll is not worth surfacing; the next one retries.
    }
  }, [streamId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setInterval(() => refresh(controller.signal), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    onSeatsChange?.(seats);
  }, [seats, onSeatsChange]);

  const act = useCallback(
    async (position: number | null, body: Record<string, unknown>) => {
      setBusy(position ?? -1);
      setError(null);
      try {
        await api(`/api/streams/${streamId}/seats`, { method: 'POST', body });
        await refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'That did not work');
      } finally {
        setBusy(null);
      }
    },
    [streamId, refresh],
  );

  async function invite(event: React.FormEvent<HTMLFormElement>, position: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim().toLowerCase();
    if (!username) return;
    setInviting(null);
    await act(position, { action: 'INVITE', position, username });
  }

  const onASeat = seats.some((s) => s.isMine);

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between pb-1.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Stage</h2>
        {onASeat && (
          <button
            type="button"
            onClick={() => act(null, { action: 'LEAVE' })}
            disabled={busy !== null}
            className="text-[11px] font-semibold text-live hover:underline"
          >
            Leave seat
          </button>
        )}
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {seats.map((seat) => {
          const working = busy === seat.position;
          return (
            <li key={seat.id} className="relative">
              <div
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-center transition ${
                  seat.isMine
                    ? 'border-nexus-400 bg-nexus-500/20'
                    : seat.state === 'OCCUPIED'
                      ? 'border-white/15 bg-white/[0.06]'
                      : seat.state === 'LOCKED'
                        ? 'border-white/5 bg-black/30'
                        : seat.invitedMe
                          ? 'border-bean/60 bg-bean/10'
                          : 'border-dashed border-white/15 bg-white/[0.02]'
                }`}
              >
                {seat.user ? (
                  <>
                    <Avatar name={seat.user.displayName} src={seat.user.avatarUrl} size={28} />
                    <span className="max-w-full truncate px-1 text-[10px] font-semibold text-slate-200">
                      {seat.user.displayName}
                    </span>
                    {seat.mutedByHost && <span className="text-[9px] text-live">muted</span>}
                  </>
                ) : seat.state === 'LOCKED' ? (
                  <>
                    <span className="text-lg opacity-50">🔒</span>
                    <span className="text-[10px] text-slate-600">Locked</span>
                  </>
                ) : seat.state === 'INVITED' ? (
                  <>
                    <span className="text-lg">✉️</span>
                    <span className="max-w-full truncate px-1 text-[10px] text-slate-400">
                      {seat.invitedMe ? 'You' : (seat.invitedUser?.displayName ?? 'Invited')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg opacity-40">＋</span>
                    <span className="text-[10px] text-slate-500">Seat {seat.position}</span>
                  </>
                )}
              </div>

              {/* Viewer actions */}
              {!isHost && signedIn && !onASeat && (seat.state === 'OPEN' || seat.invitedMe) && (
                <button
                  type="button"
                  onClick={() => act(seat.position, { action: 'JOIN', position: seat.position })}
                  disabled={working}
                  className="absolute inset-0 rounded-xl"
                  aria-label={seat.invitedMe ? 'Accept invite' : `Join seat ${seat.position}`}
                />
              )}

              {/* Host actions */}
              {isHost && (
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {seat.user ? (
                    <>
                      <MiniButton
                        onClick={() => act(seat.position, { action: 'MUTE', position: seat.position, muted: !seat.mutedByHost })}
                        disabled={working}
                      >
                        {seat.mutedByHost ? 'unmute' : 'mute'}
                      </MiniButton>
                      <MiniButton
                        onClick={() => act(seat.position, { action: 'KICK', position: seat.position })}
                        disabled={working}
                      >
                        remove
                      </MiniButton>
                    </>
                  ) : seat.state === 'LOCKED' ? (
                    <MiniButton
                      onClick={() => act(seat.position, { action: 'OPEN', position: seat.position })}
                      disabled={working}
                    >
                      open
                    </MiniButton>
                  ) : (
                    <>
                      <MiniButton onClick={() => setInviting(seat.position)} disabled={working}>
                        invite
                      </MiniButton>
                      <MiniButton
                        onClick={() => act(seat.position, { action: 'LOCK', position: seat.position })}
                        disabled={working}
                      >
                        lock
                      </MiniButton>
                    </>
                  )}
                </div>
              )}

              {inviting === seat.position && (
                <form
                  onSubmit={(e) => invite(e, seat.position)}
                  className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 rounded-xl border border-white/15 bg-ink-800 p-2 shadow-glow"
                >
                  <input
                    name="username"
                    placeholder="username"
                    autoFocus
                    autoCapitalize="none"
                    className="input py-1 text-xs"
                  />
                  <div className="mt-1.5 flex gap-1">
                    <button type="button" onClick={() => setInviting(null)} className="btn-ghost flex-1 px-2 py-1 text-[11px]">
                      cancel
                    </button>
                    <button type="submit" className="btn-primary flex-1 px-2 py-1 text-[11px]">
                      invite
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-1.5 text-[11px] text-live">
          {error}
        </p>
      )}
    </div>
  );
}

function MiniButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
