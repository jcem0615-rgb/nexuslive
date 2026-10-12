import { requireMasterAdmin } from '@/lib/auth';
import { AppError, clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { applyStrike } from '@/lib/moderation';
import { adminStrikeSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Issue a content-policy strike.
 *
 * The ladder decides what happens — first offence an hour, second a week,
 * third a permanent ban with balances forfeited to the owner. The caller does
 * not get to pick the punishment, only to say that an offence happened.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { reason, details, reportId } = await parseJson(req, adminStrikeSchema);

  if (id === admin.id) throw AppError.forbidden('The owner account cannot be struck');

  const result = await prisma.$transaction((tx) =>
    applyStrike(tx, {
      targetId: id,
      actorId: admin.id,
      ownerId: admin.id,
      reason,
      details,
      reportId,
      ip: clientIp(req),
    }),
  );

  return ok({ strike: result }, 201);
});
