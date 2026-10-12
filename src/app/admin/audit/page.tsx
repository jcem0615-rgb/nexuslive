import { prisma } from '@/lib/prisma';
import { EmptyState, PageHeader } from '@/components/ui';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log' };

export default async function AdminAuditPage() {
  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      ip: true,
      createdAt: true,
      actor: { select: { username: true, email: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Written in the same transaction as the change it records, so there is no change without a row here."
      />

      {logs.length === 0 ? (
        <EmptyState
          title="Nothing recorded"
          body="Admin actions land here the moment one is taken."
        />
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-sm font-bold text-nexus-300">{log.action}</span>
                {log.targetType && (
                  <span className="text-xs text-slate-500">
                    {log.targetType}
                    {log.targetId ? ` · ${log.targetId}` : ''}
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-600">
                  @{log.actor.username} · {timeAgo(log.createdAt)}
                  {log.ip ? ` · ${log.ip}` : ''}
                </span>
              </div>
              {log.metadata !== null && JSON.stringify(log.metadata) !== '{}' && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-2.5 text-[11px] text-slate-400">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
