import { requireUser } from '@/lib/auth';
import { AppError, intParam, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { CLAN_CREATE_COST, CLAN_MAX_MEMBERS } from '@/lib/economy';
import { createClanSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const take = intParam(url, 'limit', 25, 60);

  const clans = await prisma.clan.findMany({
    orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
    take,
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      avatarUrl: true,
      points: true,
      memberCount: true,
      isOpen: true,
      owner: { select: { id: true, username: true, displayName: true } },
    },
  });

  return ok({ clans, maxMembers: CLAN_MAX_MEMBERS, createCost: CLAN_CREATE_COST });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { name, tag, description } = await parseJson(req, createClanSchema);

  const clan = await prisma.$transaction(async (tx) => {
    const membership = await tx.clanMember.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (membership) throw AppError.conflict('Leave your current clan first');

    const taken = await tx.clan.findFirst({
      where: { OR: [{ name }, { tag }] },
      select: { name: true },
    });
    if (taken) throw AppError.conflict('That clan name or tag is taken');

    await adjustWallet(tx, {
      userId: user.id,
      wallet: 'PURCHASED',
      amount: -CLAN_CREATE_COST,
      kind: 'CLAN_CREATE_FEE',
      memo: `Founded clan ${tag}`,
    });

    const created = await tx.clan.create({
      data: { name, tag, description, ownerId: user.id, memberCount: 1 },
    });
    await tx.clanMember.create({
      data: { clanId: created.id, userId: user.id, role: 'LEADER' },
    });

    return created;
  });

  return ok({ clan }, 201);
});
