import { canModerateStream, requireUser } from '@/lib/auth';
import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const stream = await prisma.stream.findUnique({
    where: { id },
    select: { id: true, hostId: true, status: true },
  });
  if (!stream) throw AppError.notFound('That stream is not here');
  if (!canModerateStream(user, stream.hostId)) throw AppError.forbidden('Not your stream');
  if (stream.status === 'ENDED') return ok({ stream: { id, status: 'ENDED' } });

  const ended = await prisma.stream.update({
    where: { id },
    data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
    select: { id: true, status: true, endedAt: true, beansEarned: true, peakViewers: true },
  });

  return ok({ stream: ended });
});
