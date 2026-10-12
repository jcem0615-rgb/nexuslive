import { requireUser } from '@/lib/auth';
import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ username: string }> };

/** Toggles. Returns the state it landed on. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const viewer = await requireUser();
  const { username } = await params;

  const target = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!target) throw AppError.notFound('No such profile');
  if (target.id === viewer.id) throw AppError.badRequest('You cannot follow yourself');

  const key = { followerId: viewer.id, followingId: target.id };
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: key },
    select: { id: true },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return ok({ following: false });
  }

  await prisma.$transaction(async (tx) => {
    await tx.follow.create({ data: key });
    await notify(tx, {
      userId: target.id,
      kind: 'NEW_FOLLOWER',
      title: `${viewer.displayName} followed you`,
      data: { username: viewer.username },
    });
  });
  return ok({ following: true }, 201);
});
