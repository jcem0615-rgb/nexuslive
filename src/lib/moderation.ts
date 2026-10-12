/**
 * Enforcement of the content policy.
 *
 * The ladder (1 hour, 1 week, permanent ban) lives in economy.ts; this module
 * is only the machinery that applies a rung and makes it stick.
 *
 * What issues a strike today is a human reviewing a report. There is no
 * automated nudity detection — that needs a classifier this project does not
 * have. `applyStrike` is the seam: point a classifier at it and the whole
 * ladder, forfeiture and audit trail come along unchanged.
 */
import type { StrikeAction } from '@prisma/client';
import { strikeFor } from './economy';
import { AppError } from './http';
import { notify } from './notify';
import { writeAudit } from './audit';
import { adjustWallet, lockUsers, type Tx } from './wallet';

export type ApplyStrikeArgs = {
  /// Who is being struck.
  targetId: string;
  /// The Master Admin issuing it.
  actorId: string;
  /// The owner account balances are forfeited to on a ban.
  ownerId: string;
  reason: string;
  details?: string;
  reportId?: string;
  ip?: string;
};

export type AppliedStrike = {
  strikeId: string;
  offenceNumber: number;
  action: StrikeAction;
  restrictedUntil: Date | null;
  label: string;
  forfeitedDiamonds: number;
  forfeitedBeans: number;
};

/**
 * Issue one strike and carry out whatever rung it lands on.
 *
 * Must be called inside prisma.$transaction: the strike row, the account
 * change, both ledger movements, the notification and the audit row all land
 * together or not at all.
 */
export async function applyStrike(tx: Tx, args: ApplyStrikeArgs): Promise<AppliedStrike> {
  const { targetId, actorId, ownerId, reason, details, reportId, ip } = args;

  if (targetId === ownerId) {
    throw AppError.forbidden('The owner account cannot be struck');
  }

  // Both rows are locked up front, in sorted order, because a ban moves money
  // between them (rule 2).
  await lockUsers(tx, [targetId, ownerId]);

  const target = await tx.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      username: true,
      strikeCount: true,
      bannedAt: true,
      purchasedDiamonds: true,
      earnedDiamonds: true,
    },
  });
  if (!target) throw AppError.notFound('No such account');
  if (target.bannedAt) throw AppError.conflict('That account is already banned');

  const offenceNumber = target.strikeCount + 1;
  const outcome = strikeFor(offenceNumber);
  const now = new Date();

  let restrictedUntil: Date | null = null;
  let forfeitedDiamonds = 0;
  let forfeitedBeans = 0;

  if (outcome.action === 'RESTRICT') {
    restrictedUntil = new Date(now.getTime() + outcome.hours! * 3_600_000);
    await tx.user.update({
      where: { id: targetId },
      data: { strikeCount: offenceNumber, restrictedUntil },
    });
  } else {
    // Ban. Lock the account first so nothing else can spend while we move the
    // balances off it.
    await tx.user.update({
      where: { id: targetId },
      data: {
        strikeCount: offenceNumber,
        bannedAt: now,
        isLocked: true,
        lockedReason: `Permanently banned: ${reason}`,
        lockedAt: now,
        restrictedUntil: null,
      },
    });

    forfeitedDiamonds = target.purchasedDiamonds;
    forfeitedBeans = target.earnedDiamonds;

    // Each wallet moves to the matching wallet on the owner. A forfeit never
    // turns a spend-only diamond into a cashable bean (rule 3).
    for (const [wallet, amount] of [
      ['PURCHASED', forfeitedDiamonds],
      ['EARNED', forfeitedBeans],
    ] as const) {
      if (amount <= 0) continue;

      await adjustWallet(tx, {
        userId: targetId,
        wallet,
        amount: -amount,
        kind: 'FORFEIT_OUT',
        refType: 'Strike',
        refId: targetId,
        memo: `Forfeited on permanent ban: ${reason}`,
        preLocked: true,
      });
      await adjustWallet(tx, {
        userId: ownerId,
        wallet,
        amount,
        kind: 'FORFEIT_IN',
        refType: 'Strike',
        refId: targetId,
        memo: `Forfeited from @${target.username}`,
        preLocked: true,
      });
    }
  }

  const strike = await tx.strike.create({
    data: {
      userId: targetId,
      issuedById: actorId,
      offenceNumber,
      action: outcome.action,
      reason,
      details,
      restrictedUntil,
      reportId,
      forfeitedDiamonds,
      forfeitedBeans,
    },
    select: { id: true },
  });

  await notify(tx, {
    userId: targetId,
    kind: 'STRIKE_ISSUED',
    title: outcome.label,
    body: reason,
    data: {
      offenceNumber,
      action: outcome.action,
      restrictedUntil: restrictedUntil?.toISOString() ?? null,
    },
  });

  await writeAudit(tx, {
    actorId,
    action: outcome.action === 'BAN' ? 'moderation.ban' : 'moderation.restrict',
    targetType: 'User',
    targetId,
    metadata: {
      username: target.username,
      offenceNumber,
      reason,
      details: details ?? null,
      restrictedUntil: restrictedUntil?.toISOString() ?? null,
      forfeitedDiamonds,
      forfeitedBeans,
      reportId: reportId ?? null,
    },
    ip,
  });

  return {
    strikeId: strike.id,
    offenceNumber,
    action: outcome.action,
    restrictedUntil,
    label: outcome.label,
    forfeitedDiamonds,
    forfeitedBeans,
  };
}

/** Lift a restriction early. Does NOT reduce strikeCount — the ladder stands. */
export async function liftRestriction(
  tx: Tx,
  args: { targetId: string; actorId: string; note?: string; ip?: string },
): Promise<void> {
  const target = await tx.user.findUnique({
    where: { id: args.targetId },
    select: { username: true, bannedAt: true },
  });
  if (!target) throw AppError.notFound('No such account');
  if (target.bannedAt) throw AppError.conflict('That account is banned, not restricted');

  await tx.user.update({
    where: { id: args.targetId },
    data: { restrictedUntil: null },
  });

  await notify(tx, {
    userId: args.targetId,
    kind: 'SYSTEM',
    title: 'Your restriction was lifted',
    body: args.note ?? 'You can go live again.',
  });

  await writeAudit(tx, {
    actorId: args.actorId,
    action: 'moderation.lift_restriction',
    targetType: 'User',
    targetId: args.targetId,
    metadata: { username: target.username, note: args.note ?? null },
    ip: args.ip,
  });
}

/** True while a RESTRICT strike is still running. */
export function isRestricted(user: { restrictedUntil: Date | null }): boolean {
  return user.restrictedUntil !== null && user.restrictedUntil.getTime() > Date.now();
}

/** Seats and streams are created with a fixed set of positions. */
export function seatPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}
