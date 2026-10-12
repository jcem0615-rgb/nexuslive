'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

export function ProfileActions({
  username,
  isSelf,
  signedIn,
  following: initial,
}: {
  username: string;
  isSelf: boolean;
  signedIn: boolean;
  following: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [pending, setPending] = useState(false);

  if (isSelf) {
    return (
      <button
        type="button"
        onClick={async () => {
          await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
          router.push('/');
          router.refresh();
        }}
        className="btn-ghost shrink-0 text-xs"
      >
        Sign out
      </button>
    );
  }

  if (!signedIn) {
    return (
      <Link href="/login" className="btn-primary shrink-0 text-xs">
        Follow
      </Link>
    );
  }

  async function toggle() {
    setPending(true);
    try {
      const result = await api<{ following: boolean }>(`/api/users/${username}/follow`, {
        method: 'POST',
      });
      setFollowing(result.following);
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={following ? 'btn-ghost shrink-0 text-xs' : 'btn-primary shrink-0 text-xs'}
    >
      {pending ? '…' : following ? 'Following' : 'Follow'}
    </button>
  );
}
