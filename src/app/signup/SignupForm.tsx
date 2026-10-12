'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { FieldError, FormError } from '@/components/AuthShell';
import {
  CONTENT_POLICY_BODY,
  CONTENT_POLICY_TITLE,
  PASSWORD_MIN_LENGTH,
  SIGNUP_BONUS_DIAMONDS,
} from '@/lib/economy';
import { DiamondIcon } from '@/components/ui';

type Fields = Record<string, string[]>;

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      await api('/api/auth/signup', {
        method: 'POST',
        body: {
          email: form.get('email'),
          username: form.get('username'),
          password: form.get('password'),
          displayName: form.get('displayName'),
          phone: form.get('phone'),
          acceptPolicy: form.get('acceptPolicy') === 'on',
          gender: form.get('gender') || undefined,
        },
      });
      router.refresh();
      router.push('/wallet');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.details ?? {});
      } else {
        setError('Could not create your account');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError message={error} />

      <label className="label" htmlFor="displayName">
        Display name
      </label>
      <input id="displayName" name="displayName" required className="input" placeholder="Aria" />
      <FieldError message={fields.displayName?.[0]} />

      <label className="label mt-4" htmlFor="username">
        Username
      </label>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-500">@</span>
        <input
          id="username"
          name="username"
          required
          className="input"
          placeholder="aria"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>
      <FieldError message={fields.username?.[0]} />

      <label className="label mt-4" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="input"
        placeholder="you@example.com"
      />
      <FieldError message={fields.email?.[0]} />

      <label className="label mt-4" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        className="input"
        placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
      />
      <FieldError message={fields.password?.[0]} />

      <label className="label mt-4" htmlFor="phone">
        Phone
      </label>
      <input
        id="phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        className="input"
        placeholder="+639171234567"
      />
      <p className="mt-1 text-[11px] text-slate-600">
        Include the country code. One email, one number, one username — one account.
      </p>
      <FieldError message={fields.phone?.[0]} />

      <label className="label mt-4" htmlFor="gender">
        Gender <span className="font-normal normal-case text-slate-500">(optional)</span>
      </label>
      <select id="gender" name="gender" className="input" defaultValue="UNSPECIFIED">
        <option value="UNSPECIFIED">Prefer not to say</option>
        <option value="FEMALE">Female</option>
        <option value="MALE">Male</option>
        <option value="OTHER">Other</option>
      </select>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            name="acceptPolicy"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-nexus-500"
          />
          <span className="text-xs leading-relaxed text-slate-400">
            <strong className="text-slate-200">{CONTENT_POLICY_TITLE}.</strong>{' '}
            {CONTENT_POLICY_BODY}
          </span>
        </label>
        <FieldError message={fields.acceptPolicy?.[0]} />
      </div>

      <button type="submit" disabled={pending} className="btn-primary mt-4 w-full">
        {pending ? 'Creating…' : 'Create account'}
      </button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <DiamondIcon className="h-3.5 w-3.5 text-diamond" />
        {SIGNUP_BONUS_DIAMONDS} diamonds land in your wallet right away
      </p>
    </form>
  );
}
