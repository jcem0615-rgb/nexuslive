'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Card } from '@/components/ui';

type Props = {
  user: {
    displayName: string;
    username: string;
    bio: string;
    gender: string;
    country: string;
    avatarUrl: string;
    phoneMasked: string | null;
  };
};

export function ProfileForm({ user }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [changePhone, setChangePhone] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFields({});

    const form = new FormData(event.currentTarget);
    const phone = String(form.get('phone') ?? '').trim();

    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: {
          displayName: form.get('displayName'),
          username: form.get('username'),
          bio: form.get('bio') || undefined,
          gender: form.get('gender'),
          country: String(form.get('country') ?? '').trim() || undefined,
          avatarUrl: String(form.get('avatarUrl') ?? '').trim(),
          ...(changePhone && phone ? { phone } : {}),
        },
      });
      setMessage({ tone: 'ok', text: 'Saved.' });
      setChangePhone(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ tone: 'bad', text: err.message });
        setFields(err.details ?? {});
      } else {
        setMessage({ tone: 'bad', text: 'Could not save your profile' });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save}>
        {message && (
          <p
            role="status"
            className={`mb-4 rounded-xl px-3.5 py-2.5 text-sm ${
              message.tone === 'ok'
                ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : 'border border-live/30 bg-live/10 text-live'
            }`}
          >
            {message.text}
          </p>
        )}

        <label className="label" htmlFor="displayName">
          Display name
        </label>
        <input id="displayName" name="displayName" defaultValue={user.displayName} required maxLength={40} className="input" />
        <FieldError message={fields.displayName?.[0]} />

        <label className="label mt-4" htmlFor="username">
          Username
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-500">@</span>
          <input
            id="username"
            name="username"
            defaultValue={user.username}
            required
            autoCapitalize="none"
            className="input"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-600">Must be unique — one username, one account.</p>
        <FieldError message={fields.username?.[0]} />

        <label className="label mt-4" htmlFor="bio">
          Bio
        </label>
        <textarea id="bio" name="bio" defaultValue={user.bio} maxLength={200} rows={3} className="input resize-none" />

        <label className="label mt-4" htmlFor="avatarUrl">
          Avatar URL
        </label>
        <input id="avatarUrl" name="avatarUrl" type="url" defaultValue={user.avatarUrl} className="input" placeholder="https://…" />
        <p className="mt-1 text-[11px] text-slate-600">
          Uploads land in Phase 12 — for now this takes a link.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="gender">
              Gender
            </label>
            <select id="gender" name="gender" defaultValue={user.gender} className="input">
              <option value="UNSPECIFIED">Prefer not to say</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="country">
              Country
            </label>
            <input id="country" name="country" defaultValue={user.country} maxLength={2} className="input uppercase" placeholder="PH" />
          </div>
        </div>

        <label className="label mt-4" htmlFor="phone">
          Phone
        </label>
        {changePhone ? (
          <>
            <input id="phone" name="phone" type="tel" className="input" placeholder="+639171234567" autoFocus />
            <p className="mt-1 text-[11px] text-slate-600">
              Include the country code. One number, one account.
            </p>
            <FieldError message={fields.phone?.[0]} />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex-1 rounded-xl border border-white/10 bg-ink-700/40 px-3.5 py-2.5 text-sm tabular-nums text-slate-400">
              {user.phoneMasked ?? 'Not set'}
            </span>
            <button type="button" onClick={() => setChangePhone(true)} className="btn-ghost shrink-0 text-xs">
              Change
            </button>
          </div>
        )}

        <button type="submit" disabled={pending} className="btn-primary mt-6 w-full">
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Card>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-live">{message}</p>;
}
