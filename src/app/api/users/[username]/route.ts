import { getUser } from '@/lib/auth';
import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { hostLevel, senderLevel } from '@/lib/economy';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ username: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { username } = await params;
  const viewer = await getUser();

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      gender: true,
      country: true,
      role: true,
      totalSpent: true,
      totalEarned: true,
      isLocked: true,
      createdAt: true,
      clanMembership: {
        select: { role: true, points: true, clan: { select: { id: true, name: true, tag: true } } },
      },
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user || user.isLocked) throw AppError.notFound('No such profile');

  const [liveStream, isFollowing] = await Promise.all([
    prisma.stream.findFirst({
      where: { hostId: user.id, status: 'LIVE' },
      select: { id: true, title: true, viewerCount: true },
    }),
    viewer
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } },
          select: { id: true },
        })
      : null,
  ]);

  // Balances are nobody else's business — only the counters are public.
  const { isLocked: _isLocked, ...publicUser } = user;

  return ok({
    user: {
      ...publicUser,
      senderLevel: senderLevel(user.totalSpent),
      hostLevel: hostLevel(user.totalEarned),
      followers: user._count.followers,
      following: user._count.following,
    },
    liveStream,
    isFollowing: Boolean(isFollowing),
    isSelf: viewer?.id === user.id,
  });
});
