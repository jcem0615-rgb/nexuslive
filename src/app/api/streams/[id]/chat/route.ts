import { requireUnrestricted } from '@/lib/auth';
import { AppError, intParam, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { CHAT_RATE_PER_MINUTE } from '@/lib/economy';
import { chatSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const MESSAGE_SELECT = {
  id: true,
  body: true,
  isSystem: true,
  createdAt: true,
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

export const GET = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const take = intParam(url, 'limit', 50, 100);
  const after = url.searchParams.get('after');

  const messages = await prisma.chatMessage.findMany({
    where: { streamId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: after ? 'asc' : 'desc' },
    take,
    select: MESSAGE_SELECT,
  });

  return ok({ messages: after ? messages : messages.reverse() });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUnrestricted();
  const { id } = await params;
  const { body } = await parseJson(req, chatSchema);

  const stream = await prisma.stream.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!stream) throw AppError.notFound('That stream is not here');
  if (stream.status !== 'LIVE') throw AppError.badRequest('That stream has ended');

  // Flood guard. Redis is the planned home for this; a count works until then.
  const recent = await prisma.chatMessage.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (recent >= CHAT_RATE_PER_MINUTE) throw AppError.tooMany('Easy — too many messages');

  const message = await prisma.chatMessage.create({
    data: { streamId: id, userId: user.id, body },
    select: MESSAGE_SELECT,
  });

  return ok({ message }, 201);
});
