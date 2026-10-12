import { requireMasterAdmin } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const GET = route(async (req) => {
  await requireMasterAdmin();

  const url = new URL(req.url);
  const take = intParam(url, 'limit', 25, 100);
  const skip = (intParam(url, 'page', 1, 1_000) - 1) * take;
  const q = url.searchParams.get('q')?.trim();

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
          { displayName: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        purchasedDiamonds: true,
        earnedDiamonds: true,
        totalSpent: true,
        totalEarned: true,
        isLocked: true,
        lockedReason: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ users, total, page: Math.floor(skip / take) + 1, perPage: take });
});
