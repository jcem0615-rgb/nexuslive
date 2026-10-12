'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { FormError } from '@/components/AuthShell';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: { email: form.get('email'), password: form.get('password') },
      });
      // Server components hold the session, so refresh before navigating.
      router.refresh();
      router.push(next && next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
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

      <label className="label mt-4" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="input"
        placeholder="••••••••"
      />

      <button type="submit" disabled={pending} className="btn-primary mt-5 w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="mt-3 text-center text-xs text-slate-500">
        <Link href="/forgot-password" className="hover:text-slate-300 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
