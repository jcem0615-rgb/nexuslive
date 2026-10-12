'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { STREAM_TITLE_MAX_LENGTH } from '@/lib/economy';

export function GoLive({ liveStream }: { liveStream: { id: string; title: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (liveStream) {
    return (
      <button type="button" onClick={() => router.push(`/live/${liveStream.id}`)} className="btn-live">
        Back to your stream
      </button>
    );
  }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      const { stream } = await api<{ stream: { id: string } }>('/api/streams', {
        method: 'POST',
        body: { title: form.get('title'), category: form.get('category') },
      });
      router.push(`/live/${stream.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start your stream');
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-live">
        Go live
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="card w-full max-w-sm p-5">
        <h2 className="text-base font-extrabold text-white">Start a stream</h2>
        <form onSubmit={start} className="mt-4">
          {error && <p className="mb-3 text-sm text-live">{error}</p>}

          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={STREAM_TITLE_MAX_LENGTH}
            className="input"
            placeholder="What are you up to?"
            autoFocus
          />

          <label className="label mt-4" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" className="input" defaultValue="Just Chatting">
            <option>Just Chatting</option>
            <option>Music</option>
            <option>Gaming</option>
            <option>Dance</option>
            <option>Talk</option>
          </select>

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-live flex-1">
              {pending ? 'Starting…' : 'Go live'}
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Video is not connected yet — LiveKit is the planned transport. Chat and gifting work now.
        </p>
      </div>
    </div>
  );
}
