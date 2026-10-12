import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, PageHeader, Stat } from '@/components/ui';
import {
  BEANS_PER_USD,
  CASHOUT_FEE_RATE,
  GAME_LIST,
  GIFT_BEAN_RATE,
  expectedPayout,
  formatCents,
} from '@/lib/economy';
import { compact, thousands, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

export default async function AdminOverview() {
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [
    users,
    newUsers,
    locked,
    live,
    floats,
    gifting,
    revenue,
    pendingCashouts,
    paidCashouts,
    games,
    openReports,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { isLocked: true } }),
    prisma.stream.count({ where: { status: 'LIVE' } }),
    prisma.user.aggregate({ _sum: { purchasedDiamonds: true, earnedDiamonds: true } }),
    prisma.giftTransaction.aggregate({ _sum: { diamondCost: true, beansCredited: true } }),
    prisma.diamondPurchase.aggregate({
      where: { status: 'PAID' },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.cashoutRequest.aggregate({
      where: { status: { in: ['PENDING', 'APPROVED'] } },
      _sum: { netCents: true },
      _count: true,
    }),
    prisma.cashoutRequest.aggregate({ where: { status: 'PAID' }, _sum: { netCents: true } }),
    prisma.gameRound.aggregate({ _sum: { wagerDiamonds: true, payoutBeans: true }, _count: true }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, action: true, targetType: true, createdAt: true },
    }),
  ]);

  const beanFloat = floats._sum.earnedDiamonds ?? 0;
  const giftedDiamonds = gifting._sum.diamondCost ?? 0;
  const giftedBeans = gifting._sum.beansCredited ?? 0;

  return (
    <>
      <PageHeader title="Overview" subtitle="Everything the platform owes and everything it took." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={thousands(users)} hint={`${newUsers} in the last 24h`} />
        <Stat label="Live now" value={thousands(live)} tone="live" />
        <Stat
          label="Gross revenue"
          value={formatCents(revenue._sum.amountCents ?? 0)}
          hint={`${revenue._count} paid orders`}
        />
        <Stat
          label="Bean liability"
          value={formatCents(Math.floor((beanFloat * 100) / BEANS_PER_USD))}
          hint={`${compact(beanFloat)} beans outstanding`}
          tone="bean"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card as="section">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Gifting</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Diamonds gifted" value={compact(giftedDiamonds)} />
            <Row label="Beans paid to hosts" value={compact(giftedBeans)} tone="bean" />
            <Row
              label={`Platform cut (${Math.round((1 - GIFT_BEAN_RATE) * 100)}%)`}
              value={compact(giftedDiamonds - giftedBeans)}
              tone="good"
            />
          </dl>
        </Card>

        <Card as="section">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
            Cash-outs
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Awaiting review"
              value={`${pendingCashouts._count} · ${formatCents(pendingCashouts._sum.netCents ?? 0)}`}
              tone={pendingCashouts._count > 0 ? 'warn' : undefined}
            />
            <Row label="Paid out" value={formatCents(paidCashouts._sum.netCents ?? 0)} />
            <Row label="Fee" value={`${Math.round(CASHOUT_FEE_RATE * 100)}%`} />
          </dl>
          {pendingCashouts._count > 0 && (
            <Link href="/admin/cashouts" className="btn-primary mt-4 w-full text-xs">
              Review {pendingCashouts._count} request{pendingCashouts._count === 1 ? '' : 's'}
            </Link>
          )}
        </Card>

        <Card as="section">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Games</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Rounds played" value={thousands(games._count)} />
            <Row label="Diamonds wagered" value={compact(games._sum.wagerDiamonds ?? 0)} />
            <Row label="Beans paid out" value={compact(games._sum.payoutBeans ?? 0)} tone="bean" />
          </dl>
          <table className="mt-3 w-full text-xs">
            <tbody className="divide-y divide-white/5">
              {GAME_LIST.map((game) => (
                <tr key={game.key}>
                  <td className="py-1.5 text-slate-300">{game.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-400">
                    {game.costDiamonds}d → {expectedPayout(game).toFixed(1)}b
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-600">
            Rates are set in src/lib/economy.ts and are not editable here, by design.
          </p>
        </Card>

        <Card as="section">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
            Attention
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Locked accounts" value={thousands(locked)} />
            <Row
              label="Open reports"
              value={thousands(openReports)}
              tone={openReports > 0 ? 'warn' : undefined}
            />
          </dl>

          <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
            Recent admin actions
          </h3>
          {recentAudit.length === 0 ? (
            <p className="text-xs text-slate-600">Nothing yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex justify-between gap-2">
                  <span className="truncate font-mono text-slate-300">{log.action}</span>
                  <span className="shrink-0 text-slate-600">{timeAgo(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'bean' | 'good' | 'warn';
}) {
  const tones = {
    bean: 'text-bean',
    good: 'text-emerald-400',
    warn: 'text-amber-300',
  } as const;
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`font-bold tabular-nums ${tone ? tones[tone] : 'text-white'}`}>{value}</dd>
    </div>
  );
}
