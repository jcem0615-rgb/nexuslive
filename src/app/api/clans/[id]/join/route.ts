import { requireUser } from '@/lib/auth';
import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { lockClan } from '@/lib/wallet';
import { CLAN_MAX_MEMBERS } from '@/lib/economy';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * The 15-member cap.
 *
 * The spec wanted it as a CHECK constraint, which Postgres won't take (no
 * subqueries in CHECK — see CLAUDE.md). Instead the clan row is locked for the
 * length of the transaction, so concurrent joins queue up and the count is
 * read after the lock, never before.
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const membership = await prisma.$transaction(async (tx) => {
    await lockClan(tx, id);

    const clan = await tx.clan.findUnique({
      where: { id },
      select: { id: true, tag: true, isOpen: true },
    });
    if (!clan) throw AppError.notFound('No such clan');
    if (!clan.isOpen) throw AppError.forbidden('That clan is invite-only');

    const existing = await tx.clanMember.findUnique({
      where: { userId: user.id },
      select: { clanId: true },
    });
    if (existing) {
      throw AppError.conflict(
        existing.clanId === id ? 'You are already in this clan' : 'Leave your current clan first',
      );
    }

    const members = await tx.clanMember.count({ where: { clanId: id } });
    if (members >= CLAN_MAX_MEMBERS) {
      throw AppError.conflict(`That clan is full (${CLAN_MAX_MEMBERS} members)`);
    }

    const created = await tx.clanMember.create({
      data: { clanId: id, userId: user.id, role: 'MEMBER' },
      select: { id: true, role: true, joinedAt: true },
    });
    await tx.clan.update({ where: { id }, data: { memberCount: members + 1 } });

    return created;
  });

  return ok({ membership }, 201);
});
