import { requireMasterAdmin } from '@/lib/auth';
import { clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { adminSettingSchema } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export const GET = route(async () => {
  await requireMasterAdmin();
  const settings = await prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  return ok({ settings });
});

/**
 * Feature flags and operational switches only. Economy numbers are not
 * editable here and never will be — they live in src/lib/economy.ts so that a
 * change to them goes through code review and the test suite (rule 6).
 */
export const PUT = route(async (req) => {
  const admin = await requireMasterAdmin();
  const { key, value } = await parseJson(req, adminSettingSchema);
  const json = (value ?? null) as Prisma.InputJsonValue;

  const setting = await prisma.$transaction(async (tx) => {
    const saved = await tx.platformSetting.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });

    await writeAudit(tx, {
      actorId: admin.id,
      action: 'setting.update',
      targetType: 'PlatformSetting',
      targetId: key,
      metadata: { key, value: json },
      ip: clientIp(req),
    });

    return saved;
  });

  return ok({ setting });
});
