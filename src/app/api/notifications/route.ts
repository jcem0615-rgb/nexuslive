import { requireUser } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const take = intParam(url, 'limit', 20, 50);
  const unreadOnly = url.searchParams.get('unread') === '1';

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return ok({ notifications: items, unread });
});
