import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { hostLevel, senderLevel } from '@/lib/economy';

export const runtime = 'nodejs';

const PUBLIC_USER = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  totalSpent: true,
  totalEarned: true,
} as const;

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const take = intParam(url, 'limit', 20, 50);
  const board = url.searchParams.get('board') ?? 'hosts';

  if (board === 'clans') {
    const clans = await prisma.clan.findMany({
      orderBy: { points: 'desc' },
      take,
      select: { id: true, name: true, tag: true, points: true, memberCount: true },
    });
    return ok({ board, clans });
  }

  if (board === 'senders') {
    const users = await prisma.user.findMany({
      where: { isLocked: false, totalSpent: { gt: 0 } },
      orderBy: { totalSpent: 'desc' },
      take,
      select: PUBLIC_USER,
    });
    return ok({
      board,
      users: users.map((u) => ({ ...u, level: senderLevel(u.totalSpent) })),
    });
  }

  const users = await prisma.user.findMany({
    where: { isLocked: false, totalEarned: { gt: 0 } },
    orderBy: { totalEarned: 'desc' },
    take,
    select: PUBLIC_USER,
  });
  return ok({
    board: 'hosts',
    users: users.map((u) => ({ ...u, level: hostLevel(u.totalEarned) })),
  });
});
