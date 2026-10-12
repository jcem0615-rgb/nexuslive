import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { EmptyState, PageHeader } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { ReportActions } from './ReportActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports' };

const FILTERS = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;
type Filter = (typeof FILTERS)[number];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status = FILTERS.find((value) => value === raw);

  const reports = await prisma.report.findMany({
    where: status ? { status: status as Filter } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      reporter: { select: { username: true } },
      targetUser: { select: { id: true, username: true, isLocked: true } },
      stream: { select: { id: true, title: true } },
    },
  });

  return (
    <>
      <PageHeader title="Reports" subtitle="What the community has flagged." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/reports"
          className={`pill ${!status ? 'bg-nexus-500 text-white' : 'bg-white/5 text-slate-300'}`}
        >
          All
        </Link>
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/reports?status=${value}`}
            className={`pill ${status === value ? 'bg-nexus-500 text-white' : 'bg-white/5 text-slate-300'}`}
          >
            {value}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <EmptyState title="All clear" body="No reports match that filter." />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{report.reason}</p>
                  {report.details && (
                    <p className="mt-1 text-xs text-slate-400">{report.details}</p>
                  )}
                  <p className="mt-1.5 text-xs text-slate-500">
                    from @{report.reporter.username} · {timeAgo(report.createdAt)}
                    {report.targetUser && (
                      <>
                        {' · about '}
                        <Link
                          href={`/u/${report.targetUser.username}`}
                          className="text-slate-300 hover:underline"
                        >
                          @{report.targetUser.username}
                        </Link>
                        {report.targetUser.isLocked && ' (locked)'}
                      </>
                    )}
                    {report.stream && (
                      <>
                        {' · '}
                        <Link
                          href={`/live/${report.stream.id}`}
                          className="text-slate-300 hover:underline"
                        >
                          {report.stream.title}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <ReportActions id={report.id} status={report.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
