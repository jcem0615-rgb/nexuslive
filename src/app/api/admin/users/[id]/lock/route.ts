import { requireMasterAdmin } from '@/lib/auth';
import { AppError, clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { isMasterAdmin } from '@/lib/session';
import { adminLockSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { locked, reason } = await parseJson(req, adminLockSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, username: true },
  });
  if (!target) throw AppError.notFound('No such account');
  if (isMasterAdmin(target)) throw AppError.forbidden('The owner account cannot be locked');

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        isLocked: locked,
        lockedReason: locked ? (reason ?? 'Locked by an administrator') : null,
        lockedAt: locked ? new Date() : null,
      },
      select: { id: true, username: true, isLocked: true, lockedReason: true },
    });

    await writeAudit(tx, {
      actorId: admin.id,
      action: locked ? 'user.lock' : 'user.unlock',
      targetType: 'User',
      targetId: id,
      metadata: { username: target.username, reason: reason ?? null },
      ip: clientIp(req),
    });

    return user;
  });

  return ok({ user: updated });
});
