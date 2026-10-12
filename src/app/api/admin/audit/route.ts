import { requireMasterAdmin } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const GET = route(async (req) => {
  await requireMasterAdmin();

  const url = new URL(req.url);
  const take = intParam(url, 'limit', 50, 200);
  const action = url.searchParams.get('action') ?? undefined;

  const logs = await prisma.adminAuditLog.findMany({
    where: action ? { action } : {},
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { select: { username: true, email: true } } },
  });

  return ok({ logs });
});
