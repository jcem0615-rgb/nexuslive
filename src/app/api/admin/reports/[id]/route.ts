import { requireMasterAdmin } from '@/lib/auth';
import { clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { adminReportSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { status } = await parseJson(req, adminReportSchema);

  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({
      where: { id },
      data: {
        status,
        handledById: admin.id,
        handledAt: status === 'REVIEWING' ? null : new Date(),
      },
      select: { id: true, status: true, reason: true },
    });

    await writeAudit(tx, {
      actorId: admin.id,
      action: 'report.update',
      targetType: 'Report',
      targetId: id,
      metadata: { status },
      ip: clientIp(req),
    });

    return updated;
  });

  return ok({ report });
});
