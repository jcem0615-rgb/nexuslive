import { getUser, requireUnrestricted } from '@/lib/auth';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notify';
import { SEAT_INVITE_TTL_MINUTES, STREAM_SEAT_COUNT } from '@/lib/economy';
import { seatActionSchema } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const SEAT_SELECT = {
  id: true,
  position: true,
  state: true,
  mutedByHost: true,
  invitedAt: true,
  joinedAt: true,
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  invitedUser: { select: { id: true, username: true, displayName: true } },
} as const;

/** An invite nobody accepted must not hold a seat hostage forever. */
function inviteExpired(invitedAt: Date | null): boolean {
  if (!invitedAt) return true;
  return Date.now() - invitedAt.getTime() > SEAT_INVITE_TTL_MINUTES * 60_000;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const viewer = await getUser();

  const seats = await prisma.streamSeat.findMany({
    where: { streamId: id },
    orderBy: { position: 'asc' },
    select: SEAT_SELECT,
  });

  return ok({
    seats: seats.map((seat) => ({
      ...seat,
      // Report a lapsed invite as open rather than making every client work
      // the TTL out for itself.
      state: seat.state === 'INVITED' && inviteExpired(seat.invitedAt) ? 'OPEN' : seat.state,
      isMine: Boolean(viewer && seat.user?.id === viewer.id),
      invitedMe: Boolean(viewer && seat.invitedUser?.id === viewer.id),
    })),
    seatCount: STREAM_SEAT_COUNT,
    inviteTtlMinutes: SEAT_INVITE_TTL_MINUTES,
  });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUnrestricted();
  const { id } = await params;
  const body = await parseJson(req, seatActionSchema);

  const stream = await prisma.stream.findUnique({
    where: { id },
    select: { id: true, hostId: true, status: true, title: true },
  });
  if (!stream) throw AppError.notFound('That stream is not here');
  if (stream.status !== 'LIVE') throw AppError.badRequest('That stream has ended');

  const isHost = stream.hostId === user.id;
  const hostOnly = (['OPEN', 'LOCK', 'INVITE', 'KICK', 'MUTE'] as const).some(
    (a) => a === body.action,
  );
  if (hostOnly && !isHost) throw AppError.forbidden('Only the host can do that');

  const seat = await prisma.$transaction(async (tx) => {
    // LEAVE has no position: it acts on whichever seat the caller is on.
    if (body.action === 'LEAVE') {
      const mine = await tx.streamSeat.findFirst({
        where: { streamId: id, userId: user.id },
        select: { id: true, position: true },
      });
      if (!mine) throw AppError.badRequest('You are not on a seat');
      return tx.streamSeat.update({
        where: { id: mine.id },
        data: { state: 'OPEN', userId: null, invitedUserId: null, invitedAt: null, joinedAt: null, mutedByHost: false },
        select: SEAT_SELECT,
      });
    }

    const current = await tx.streamSeat.findUnique({
      where: { streamId_position: { streamId: id, position: body.position } },
      select: { id: true, state: true, userId: true, invitedUserId: true, invitedAt: true },
    });
    if (!current) throw AppError.notFound('No such seat');

    switch (body.action) {
      case 'OPEN':
      case 'LOCK': {
        if (current.userId) throw AppError.conflict('Someone is on that seat — remove them first');
        return tx.streamSeat.update({
          where: { id: current.id },
          data: {
            state: body.action === 'OPEN' ? 'OPEN' : 'LOCKED',
            invitedUserId: null,
            invitedAt: null,
          },
          select: SEAT_SELECT,
        });
      }

      case 'INVITE': {
        if (current.userId) throw AppError.conflict('Someone is already on that seat');
        const invitee = await tx.user.findUnique({
          where: { username: body.username },
          select: { id: true, isLocked: true, restrictedUntil: true },
        });
        if (!invitee) throw AppError.notFound('No such person');
        if (invitee.id === stream.hostId) throw AppError.badRequest('You are already hosting');
        if (invitee.isLocked) throw AppError.forbidden('That account cannot join');
        if (invitee.restrictedUntil && invitee.restrictedUntil > new Date()) {
          throw AppError.forbidden('That account is restricted');
        }

        const updated = await tx.streamSeat.update({
          where: { id: current.id },
          data: { state: 'INVITED', invitedUserId: invitee.id, invitedAt: new Date() },
          select: SEAT_SELECT,
        });

        await notify(tx, {
          userId: invitee.id,
          kind: 'SEAT_INVITE',
          title: `Invited on stage by ${user.displayName}`,
          body: stream.title,
          data: { streamId: id, position: body.position, expiresInMinutes: SEAT_INVITE_TTL_MINUTES },
        });
        return updated;
      }

      case 'JOIN': {
        if (isHost) throw AppError.badRequest('You are the host — you already have the stage');

        const openToAnyone = current.state === 'OPEN';
        const openToMe = current.state === 'INVITED' && current.invitedUserId === user.id;
        const lapsed = current.state === 'INVITED' && inviteExpired(current.invitedAt);
        if (!openToAnyone && !openToMe && !lapsed) {
          throw AppError.conflict(
            current.state === 'LOCKED' ? 'That seat is locked' : 'That seat is taken',
          );
        }

        // Conditional update rather than read-then-write: two people tapping
        // the same open seat at the same moment both reach here, and exactly
        // one of them matches the `state` guard.
        const claimed = await tx.streamSeat.updateMany({
          where: { id: current.id, state: current.state, userId: null },
          data: {
            state: 'OCCUPIED',
            userId: user.id,
            invitedUserId: null,
            invitedAt: null,
            joinedAt: new Date(),
            mutedByHost: false,
          },
        });
        if (claimed.count !== 1) throw AppError.conflict('Someone just took that seat');

        await notify(tx, {
          userId: stream.hostId,
          kind: 'SEAT_JOINED',
          title: `${user.displayName} joined seat ${body.position}`,
          data: { streamId: id, position: body.position, userId: user.id },
        });

        return tx.streamSeat.findUniqueOrThrow({ where: { id: current.id }, select: SEAT_SELECT });
      }

      case 'KICK': {
        if (!current.userId) throw AppError.badRequest('That seat is already empty');
        return tx.streamSeat.update({
          where: { id: current.id },
          data: { state: 'OPEN', userId: null, joinedAt: null, mutedByHost: false },
          select: SEAT_SELECT,
        });
      }

      case 'MUTE': {
        if (!current.userId) throw AppError.badRequest('Nobody is on that seat');
        return tx.streamSeat.update({
          where: { id: current.id },
          data: { mutedByHost: body.muted },
          select: SEAT_SELECT,
        });
      }
    }
  });

  return ok({ seat });
});

export type SeatPayload = Prisma.StreamSeatGetPayload<{ select: typeof SEAT_SELECT }>;
