'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

export function ClanMembership({
  clanId,
  isMember,
  isLeader,
  inAnotherClan,
  isFull,
  isOpen,
}: {
  clanId: string;
  isMember: boolean;
  isLeader: boolean;
  inAnotherClan: boolean;
  isFull: boolean;
  isOpen: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: 'join' | 'leave') {
    setPending(true);
    setError(null);
    try {
      await api(`/api/clans/${clanId}/${path}`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work');
    } finally {
      setPending(false);
    }
  }

  if (isLeader) {
    return <span className="pill bg-nexus-500/20 text-nexus-200">Leader</span>;
  }

  const disabledReason = inAnotherClan
    ? 'Leave your clan first'
    : isFull
      ? 'Clan is full'
      : !isOpen
        ? 'Invite only'
        : null;

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => act(isMember ? 'leave' : 'join')}
        disabled={pending || (!isMember && disabledReason !== null)}
        className={isMember ? 'btn-ghost text-xs' : 'btn-primary text-xs'}
      >
        {pending ? '…' : isMember ? 'Leave' : (disabledReason ?? 'Join')}
      </button>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-live">
          {error}
        </p>
      )}
    </div>
  );
}
