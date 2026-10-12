'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { CLAN_NAME_MAX, CLAN_NAME_MIN, CLAN_TAG_MAX, CLAN_TAG_MIN } from '@/lib/economy';
import { thousands } from '@/lib/format';

export function CreateClan({ cost, diamonds }: { cost: number; diamonds: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      const { clan } = await api<{ clan: { id: string } }>('/api/clans', {
        method: 'POST',
        body: {
          name: form.get('name'),
          tag: form.get('tag'),
          description: form.get('description') || undefined,
        },
      });
      router.push(`/clans/${clan.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not found your clan');
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary text-xs">
        Found a clan
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="card w-full max-w-sm p-5">
        <h2 className="text-base font-extrabold text-white">Found a clan</h2>
        <p className="mt-1 text-xs text-slate-400">
          Costs {thousands(cost)} diamonds. You have {thousands(diamonds)}.
        </p>

        <form onSubmit={create} className="mt-4">
          {error && <p className="mb-3 text-sm text-live">{error}</p>}

          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={CLAN_NAME_MIN}
            maxLength={CLAN_NAME_MAX}
            className="input"
            placeholder="Nova Syndicate"
            autoFocus
          />

          <label className="label mt-4" htmlFor="tag">
            Tag
          </label>
          <input
            id="tag"
            name="tag"
            required
            minLength={CLAN_TAG_MIN}
            maxLength={CLAN_TAG_MAX}
            className="input uppercase"
            placeholder="NOVA"
            autoCapitalize="characters"
          />

          <label className="label mt-4" htmlFor="description">
            Description <span className="font-normal normal-case text-slate-500">(optional)</span>
          </label>
          <input id="description" name="description" maxLength={200} className="input" />

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || diamonds < cost}
              className="btn-primary flex-1"
            >
              {pending ? 'Founding…' : diamonds < cost ? 'Not enough' : 'Found it'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
