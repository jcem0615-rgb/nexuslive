import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { hostLevel } from '@/lib/economy';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;

  const stream = await prisma.stream.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      viewerCount: true,
      peakViewers: true,
      beansEarned: true,
      startedAt: true,
      endedAt: true,
      host: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          totalEarned: true,
        },
      },
    },
  });
  if (!stream) throw AppError.notFound('That stream is not here');

  const [messages, topGifters] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { streamId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        body: true,
        isSystem: true,
        createdAt: true,
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.giftTransaction.groupBy({
      by: ['senderId'],
      where: { streamId: id },
      _sum: { diamondCost: true },
      orderBy: { _sum: { diamondCost: 'desc' } },
      take: 5,
    }),
  ]);

  const senders = topGifters.length
    ? await prisma.user.findMany({
        where: { id: { in: topGifters.map((g) => g.senderId) } },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    : [];

  return ok({
    stream: { ...stream, host: { ...stream.host, level: hostLevel(stream.host.totalEarned) } },
    messages: messages.reverse(),
    topGifters: topGifters.map((entry) => ({
      diamonds: entry._sum.diamondCost ?? 0,
      user: senders.find((s) => s.id === entry.senderId) ?? null,
    })),
  });
});
