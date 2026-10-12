import { requireMasterAdmin } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import type { CashoutStatus } from '@prisma/client';

export const runtime = 'nodejs';

const STATUSES = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const;

export const GET = route(async (req) => {
  await requireMasterAdmin();

  const url = new URL(req.url);
  const take = intParam(url, 'limit', 25, 100);
  const raw = url.searchParams.get('status');
  const status = STATUSES.find((s) => s === raw) as CashoutStatus | undefined;

  const requests = await prisma.cashoutRequest.findMany({
    where: status ? { status } : {},
    orderBy: { requestedAt: 'desc' },
    take,
    include: {
      user: {
        select: { id: true, username: true, displayName: true, email: true, earnedDiamonds: true },
      },
      reviewedBy: { select: { username: true } },
    },
  });

  return ok({ requests });
});
