import { requireMasterAdmin } from '@/lib/auth';
import { clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { liftRestriction } from '@/lib/moderation';
import { adminLiftRestrictionSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Clears a running restriction. The strike count stands — the ladder does not reset. */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { note } = await parseJson(req, adminLiftRestrictionSchema);

  await prisma.$transaction((tx) =>
    liftRestriction(tx, { targetId: id, actorId: admin.id, note, ip: clientIp(req) }),
  );

  return ok({ lifted: true });
});
