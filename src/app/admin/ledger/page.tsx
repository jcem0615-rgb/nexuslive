import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { EmptyState, PageHeader } from '@/components/ui';
import { ledgerLabel, signed, thousands, timeAgo } from '@/lib/format';
import type { LedgerKind, Wallet } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ledger' };

const WALLETS = ['PURCHASED', 'EARNED'] as const;

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; wallet?: string; kind?: string }>;
}) {
  const { userId, wallet: walletRaw, kind } = await searchParams;
  const wallet = WALLETS.find((value) => value === walletRaw) as Wallet | undefined;

  const [entries, subject] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(wallet ? { wallet } : {}),
        ...(kind ? { kind: kind as LedgerKind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        wallet: true,
        kind: true,
        amount: true,
        balanceAfter: true,
        memo: true,
        createdAt: true,
        user: { select: { id: true, username: true, displayName: true } },
      },
    }),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { username: true, displayName: true },
        })
      : null,
  ]);

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle={
          subject
            ? `Every movement for @${subject.username}`
            : 'Every balance movement on the platform, newest first'
        }
        action={
          userId ? (
            <Link href="/admin/ledger" className="btn-ghost text-xs">
              Clear filter
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={userId ? `/admin/ledger?userId=${userId}` : '/admin/ledger'}
          className={`pill ${!wallet ? 'bg-nexus-500 text-white' : 'bg-white/5 text-slate-300'}`}
        >
          Both wallets
        </Link>
        {WALLETS.map((value) => (
          <Link
            key={value}
            href={`/admin/ledger?wallet=${value}${userId ? `&userId=${userId}` : ''}`}
            className={`pill ${wallet === value ? 'bg-nexus-500 text-white' : 'bg-white/5 text-slate-300'}`}
          >
            {value === 'PURCHASED' ? 'Diamonds' : 'Beans'}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No entries" body="Nothing matches that filter yet." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Movement</th>
                <th className="px-4 py-2.5 font-semibold">Wallet</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                <th className="px-4 py-2.5 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/u/${entry.user.username}`} className="hover:underline">
                      <span className="text-white">{entry.user.displayName}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">
                    {ledgerLabel(entry.kind)}
                    {entry.memo && (
                      <span className="block text-xs text-slate-600">{entry.memo}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`pill ${
                        entry.wallet === 'EARNED' ? 'bg-bean/15 text-bean' : 'bg-diamond/15 text-diamond'
                      }`}
                    >
                      {entry.wallet === 'EARNED' ? 'Beans' : 'Diamonds'}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                      entry.amount > 0 ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {signed(entry.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                    {thousands(entry.balanceAfter)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-600">
                    {timeAgo(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
