import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { CLAN_MAX_MEMBERS } from '@/lib/economy';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;

  const clan = await prisma.clan.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      avatarUrl: true,
      points: true,
      memberCount: true,
      isOpen: true,
      createdAt: true,
      owner: { select: { id: true, username: true, displayName: true } },
      members: {
        orderBy: [{ role: 'asc' }, { points: 'desc' }],
        select: {
          id: true,
          role: true,
          points: true,
          joinedAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!clan) throw AppError.notFound('No such clan');

  return ok({ clan, maxMembers: CLAN_MAX_MEMBERS });
});
