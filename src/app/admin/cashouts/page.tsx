import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { EmptyState, PageHeader } from '@/components/ui';
import { formatCents } from '@/lib/economy';
import { thousands, timeAgo } from '@/lib/format';
import { CashoutActions } from './CashoutActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cash-outs' };

const FILTERS = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const;
type Filter = (typeof FILTERS)[number];

export default async function AdminCashoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status = FILTERS.find((value) => value === raw);

  const requests = await prisma.cashoutRequest.findMany({
    where: status ? { status: status as Filter } : {},
    orderBy: { requestedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      beans: true,
      grossCents: true,
      feeCents: true,
      netCents: true,
      method: true,
      payoutHandle: true,
      status: true,
      reviewNote: true,
      requestedAt: true,
      user: {
        select: { id: true, username: true, displayName: true, email: true, earnedDiamonds: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Cash-outs"
        subtitle="Beans are already held off the balance when a request is filed. Rejecting one pays them back."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/cashouts"
          className={`pill ${!status ? 'bg-nexus-500 text-white' : 'bg-white/5 text-slate-300'}`}
        >
          All
        </Link>
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/cashouts?status=${value}`}
            className={`pill ${status === value ? 'bg-nexus-500 text-white' : 'bg-white/5 text-slate-300'}`}
          >
            {value}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState title="Nothing here" body="No cash-out requests match that filter." />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">
                    <Link href={`/u/${request.user.username}`} className="hover:underline">
                      {request.user.displayName}
                    </Link>{' '}
                    <span className="font-normal text-slate-500">@{request.user.username}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {request.user.email} · filed {timeAgo(request.requestedAt)}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Pay to <span className="font-mono text-slate-300">{request.payoutHandle}</span>{' '}
                    via {request.method}
                  </p>
                  {request.reviewNote && (
                    <p className="mt-1 text-xs text-slate-500">Note: {request.reviewNote}</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-lg font-extrabold tabular-nums text-white">
                    {formatCents(request.netCents)}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {thousands(request.beans)} beans · {formatCents(request.grossCents)} −{' '}
                    {formatCents(request.feeCents)} fee
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Balance after hold: {thousands(request.user.earnedDiamonds)}
                  </p>
                </div>
              </div>

              <CashoutActions id={request.id} status={request.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
