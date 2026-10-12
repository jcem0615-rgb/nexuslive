'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

type Action = 'APPROVE' | 'MARK_PAID' | 'REJECT';

export function CashoutActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const closed = status === 'PAID' || status === 'REJECTED';

  async function act(action: Action) {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/admin/cashouts/${id}`, {
        method: 'POST',
        body: { action, note: note || undefined },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not go through');
    } finally {
      setBusy(null);
    }
  }

  const tones: Record<string, string> = {
    PENDING: 'bg-amber-400/15 text-amber-300',
    APPROVED: 'bg-sky-400/15 text-sky-300',
    PAID: 'bg-emerald-400/15 text-emerald-300',
    REJECTED: 'bg-live/15 text-live',
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      {error && (
        <p role="alert" className="mb-2 text-xs text-live">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill ${tones[status] ?? 'bg-white/10 text-slate-300'}`}>{status}</span>

        {!closed && (
          <>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              className="input flex-1 py-1.5 text-xs sm:max-w-xs"
              placeholder="Note (optional)"
            />

            {status === 'PENDING' && (
              <button
                type="button"
                onClick={() => act('APPROVE')}
                disabled={busy !== null}
                className="btn-primary text-xs"
              >
                {busy === 'APPROVE' ? '…' : 'Approve'}
              </button>
            )}

            {status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => act('MARK_PAID')}
                disabled={busy !== null}
                className="btn-primary text-xs"
              >
                {busy === 'MARK_PAID' ? '…' : 'Mark paid'}
              </button>
            )}

            <button
              type="button"
              onClick={() => act('REJECT')}
              disabled={busy !== null}
              className="btn-ghost text-xs"
            >
              {busy === 'REJECT' ? '…' : 'Reject & refund'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
