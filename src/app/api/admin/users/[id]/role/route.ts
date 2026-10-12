import { requireMasterAdmin } from '@/lib/auth';
import { AppError, clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { isMasterAdmin } from '@/lib/session';
import { adminRoleSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Rule 4: the schema for this body has no MASTER_ADMIN member, so there is no
 * input that reaches it. The owner is created by the seed and nowhere else.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { role } = await parseJson(req, adminRoleSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, username: true },
  });
  if (!target) throw AppError.notFound('No such account');
  if (isMasterAdmin(target)) throw AppError.forbidden('The owner role cannot be changed');

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true },
    });

    await writeAudit(tx, {
      actorId: admin.id,
      action: 'user.role',
      targetType: 'User',
      targetId: id,
      metadata: { username: target.username, from: target.role, to: role },
      ip: clientIp(req),
    });

    return user;
  });

  return ok({ user: updated });
});
