import { randomUUID } from 'node:crypto';
import { requireUnrestricted } from '@/lib/auth';
import { AppError, intParam, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { startStreamSchema } from '@/lib/validators';
import { STREAM_SEAT_COUNT } from '@/lib/economy';

export const runtime = 'nodejs';

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const take = intParam(url, 'limit', 24, 60);
  const category = url.searchParams.get('category');

  const streams = await prisma.stream.findMany({
    where: { status: 'LIVE', ...(category ? { category } : {}) },
    orderBy: [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
    take,
    select: {
      id: true,
      title: true,
      category: true,
      thumbnailUrl: true,
      viewerCount: true,
      beansEarned: true,
      startedAt: true,
      host: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, totalEarned: true },
      },
    },
  });

  return ok({ streams });
});

/**
 * Go live. A user becomes a HOST the first time they do — that is the only
 * automatic role change in the app, and it can never reach MASTER_ADMIN
 * (rule 4).
 */
export const POST = route(async (req) => {
  const user = await requireUnrestricted();
  const { title, category } = await parseJson(req, startStreamSchema);

  const existing = await prisma.stream.findFirst({
    where: { hostId: user.id, status: 'LIVE' },
    select: { id: true },
  });
  if (existing) throw AppError.conflict('You are already live');

  const stream = await prisma.$transaction(async (tx) => {
    if (user.role === 'USER') {
      await tx.user.update({ where: { id: user.id }, data: { role: 'HOST' } });
    }
    // Seats are created with the stream, one row per position, and flipped
    // between states for its lifetime rather than created and destroyed — so
    // "seat 3 is locked" survives the guest on it leaving.
    return tx.stream.create({
      data: {
        hostId: user.id,
        title,
        category,
        roomName: `nexus_${randomUUID()}`,
        seats: {
          create: Array.from({ length: STREAM_SEAT_COUNT }, (_, i) => ({ position: i + 1 })),
        },
      },
      select: { id: true, title: true, category: true, roomName: true, startedAt: true },
    });
  });

  return ok({ stream }, 201);
});
