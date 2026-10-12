import { requireMasterAdmin } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import type { ReportStatus } from '@prisma/client';

export const runtime = 'nodejs';

const STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;

export const GET = route(async (req) => {
  await requireMasterAdmin();

  const url = new URL(req.url);
  const take = intParam(url, 'limit', 25, 100);
  const raw = url.searchParams.get('status');
  const status = STATUSES.find((s) => s === raw) as ReportStatus | undefined;

  const reports = await prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      reporter: { select: { username: true } },
      targetUser: { select: { id: true, username: true, isLocked: true } },
      stream: { select: { id: true, title: true, status: true } },
    },
  });

  return ok({ reports });
});
