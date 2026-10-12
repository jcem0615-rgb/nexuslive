import { requireUser } from '@/lib/auth';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { reportSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export const POST = route(async (req) => {
  const user = await requireUser();
  const { targetUserId, streamId, reason, details } = await parseJson(req, reportSchema);

  if (!targetUserId && !streamId) throw AppError.badRequest('Tell us what you are reporting');
  if (targetUserId === user.id) throw AppError.badRequest('You cannot report yourself');

  const report = await prisma.report.create({
    data: { reporterId: user.id, targetUserId, streamId, reason, details },
    select: { id: true, status: true, createdAt: true },
  });

  return ok({ report }, 201);
});
