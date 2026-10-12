'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { BeanIcon, DiamondIcon } from '@/components/ui';
import { thousands, timeAgo } from '@/lib/format';

type AdminUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  purchasedDiamonds: number;
  earnedDiamonds: number;
  isLocked: boolean;
  lockedReason: string | null;
  createdAt: string;
};

export function UserRow({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const isOwner = user.role === 'MASTER_ADMIN';

  async function run(work: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: 'ok', text: await work() });
      router.refresh();
    } catch (err) {
      setMessage({
        tone: 'bad',
        text: err instanceof ApiError ? err.message : 'That did not go through',
      });
    } finally {
      setBusy(false);
    }
  }

  const toggleLock = () =>
    run(async () => {
      await api(`/api/admin/users/${user.id}/lock`, {
        method: 'POST',
        body: {
          locked: !user.isLocked,
          ...(user.isLocked ? {} : { reason: 'Locked from the portal' }),
        },
      });
      return user.isLocked ? 'Account unlocked.' : 'Account locked.';
    });

  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const result = await api<{ balanceAfter: number }>(`/api/admin/users/${user.id}/adjust`, {
        method: 'POST',
        body: {
          wallet: form.get('wallet'),
          amount: Number(form.get('amount')),
          memo: form.get('memo'),
        },
      });
      return `Done. New balance: ${thousands(result.balanceAfter)}.`;
    });
  }

  async function setRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await api(`/api/admin/users/${user.id}/role`, {
        method: 'POST',
        body: { role: form.get('role') },
      });
      return 'Role updated.';
    });
  }

  return (
    <li className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
            {user.displayName}
            {isOwner && <span className="pill bg-live/15 text-live">Owner</span>}
            {user.isLocked && <span className="pill bg-amber-400/15 text-amber-300">Locked</span>}
          </p>
          <p className="truncate text-xs text-slate-500">
            <Link href={`/u/${user.username}`} className="hover:underline">
              @{user.username}
            </Link>{' '}
            · {user.email} · joined {timeAgo(user.createdAt)}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="pill bg-diamond/15 text-diamond">
            <DiamondIcon />
            <span className="tabular-nums">{thousands(user.purchasedDiamonds)}</span>
          </span>
          <span className="pill bg-bean/15 text-bean">
            <BeanIcon />
            <span className="tabular-nums">{thousands(user.earnedDiamonds)}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
          aria-expanded={open}
        >
          {open ? 'Close' : 'Manage'}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-white/10 bg-black/20 px-4 py-4">
          {message && (
            <p
              role="status"
              className={`text-sm ${message.tone === 'ok' ? 'text-emerald-400' : 'text-live'}`}
            >
              {message.text}
            </p>
          )}

          {isOwner ? (
            <p className="text-sm text-slate-400">
              This is the owner account. It cannot be locked, demoted or role-changed from here —
              the sole-admin lock is enforced in the API, not just hidden in this UI.
            </p>
          ) : (
            <>
              <form onSubmit={adjust} className="grid gap-2 sm:grid-cols-[auto_1fr_2fr_auto]">
                <select name="wallet" className="input sm:w-32" defaultValue="PURCHASED">
                  <option value="PURCHASED">Diamonds</option>
                  <option value="EARNED">Beans</option>
                </select>
                <input
                  name="amount"
                  type="number"
                  required
                  className="input tabular-nums"
                  placeholder="± amount"
                />
                <input name="memo" required minLength={3} className="input" placeholder="Reason (goes in the ledger)" />
                <button type="submit" disabled={busy} className="btn-primary text-xs">
                  Adjust
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <form onSubmit={setRole} className="flex gap-2">
                  <select name="role" className="input w-36" defaultValue={user.role}>
                    <option value="USER">User</option>
                    <option value="HOST">Host</option>
                    <option value="MODERATOR">Moderator</option>
                  </select>
                  <button type="submit" disabled={busy} className="btn-ghost text-xs">
                    Set role
                  </button>
                </form>

                <button
                  type="button"
                  onClick={toggleLock}
                  disabled={busy}
                  className={user.isLocked ? 'btn-ghost text-xs' : 'btn-live text-xs'}
                >
                  {user.isLocked ? 'Unlock account' : 'Lock account'}
                </button>

                <Link href={`/admin/ledger?userId=${user.id}`} className="btn-ghost text-xs">
                  View ledger
                </Link>
              </div>

              {user.lockedReason && (
                <p className="text-xs text-slate-500">Reason on file: {user.lockedReason}</p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
