'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

type Status = 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

export function ReportActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function set(next: Status) {
    setBusy(next);
    setError(null);
    try {
      await api(`/api/admin/reports/${id}`, { method: 'POST', body: { status: next } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not go through');
    } finally {
      setBusy(null);
    }
  }

  const tones: Record<string, string> = {
    OPEN: 'bg-amber-400/15 text-amber-300',
    REVIEWING: 'bg-sky-400/15 text-sky-300',
    RESOLVED: 'bg-emerald-400/15 text-emerald-300',
    DISMISSED: 'bg-white/10 text-slate-400',
  };

  return (
    <div className="shrink-0 text-right">
      <span className={`pill ${tones[status] ?? 'bg-white/10 text-slate-300'}`}>{status}</span>
      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        {(['REVIEWING', 'RESOLVED', 'DISMISSED'] as const)
          .filter((value) => value !== status)
          .map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => set(value)}
              disabled={busy !== null}
              className="btn-ghost px-2.5 py-1 text-[11px]"
            >
              {busy === value ? '…' : value.toLowerCase()}
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-live">
          {error}
        </p>
      )}
    </div>
  );
}
