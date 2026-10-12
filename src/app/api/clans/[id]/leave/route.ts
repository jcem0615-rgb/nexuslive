import { requireUser } from '@/lib/auth';
import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { lockClan } from '@/lib/wallet';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  await prisma.$transaction(async (tx) => {
    await lockClan(tx, id);

    const membership = await tx.clanMember.findUnique({
      where: { userId: user.id },
      select: { id: true, clanId: true, role: true },
    });
    if (!membership || membership.clanId !== id) throw AppError.badRequest('You are not in that clan');
    if (membership.role === 'LEADER') {
      throw AppError.conflict('Hand the clan to someone else before you leave');
    }

    await tx.clanMember.delete({ where: { id: membership.id } });
    const members = await tx.clanMember.count({ where: { clanId: id } });
    await tx.clan.update({ where: { id }, data: { memberCount: members } });
  });

  return ok({ left: true });
});
