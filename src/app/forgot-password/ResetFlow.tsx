'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { FormError } from '@/components/AuthShell';
import { PASSWORD_MIN_LENGTH, PASSWORD_RESET_TTL_MINUTES } from '@/lib/economy';

type RequestResponse = { message: string; devCode?: string };

export function ResetFlow() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const value = String(new FormData(event.currentTarget).get('email') ?? '');
    try {
      const data = await api<RequestResponse>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: value },
      });
      setEmail(value);
      setNotice(data.message);
      setDevCode(data.devCode ?? null);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code');
    } finally {
      setPending(false);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: { email, otp: form.get('otp'), password: form.get('password') },
      });
      router.push('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password');
      setPending(false);
    }
  }

  if (step === 'request') {
    return (
      <form onSubmit={requestCode} noValidate>
        <FormError message={error} />
        <label className="label" htmlFor="email">
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
        <button type="submit" disabled={pending} className="btn-primary mt-5 w-full">
          {pending ? 'Sending…' : 'Send code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={confirm} noValidate>
      <FormError message={error} />
      {notice && <p className="mb-4 text-sm text-slate-400">{notice}</p>}
      {devCode && (
        <p className="mb-4 rounded-xl border border-nexus-400/30 bg-nexus-500/10 px-3.5 py-2.5 text-sm text-nexus-200">
          Development only — your code is <strong className="tabular-nums">{devCode}</strong>.
          Email delivery is not wired up yet.
        </p>
      )}

      <label className="label" htmlFor="otp">
        Six-digit code
      </label>
      <input
        id="otp"
        name="otp"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        required
        className="input text-center text-lg tracking-[0.5em] tabular-nums"
        placeholder="000000"
      />
      <p className="mt-1.5 text-xs text-slate-500">Expires {PASSWORD_RESET_TTL_MINUTES} minutes after it was sent.</p>

      <label className="label mt-4" htmlFor="password">
        New password
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

      <button type="submit" disabled={pending} className="btn-primary mt-5 w-full">
        {pending ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}
