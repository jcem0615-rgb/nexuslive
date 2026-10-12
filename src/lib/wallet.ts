/**
 * The only way balances move.
 *
 * Rule 1: every diamond and every bean goes through adjustWallet(), inside a
 * prisma.$transaction. It locks the user row with SELECT ... FOR UPDATE,
 * refuses to push a balance negative, and writes a ledger_entries row in the
 * same transaction. Never call prisma.user.update() on a balance field.
 *
 * Rule 2: when a transaction touches two users (a gift), call
 * lockUsers(tx, [a, b]) before anything else — it sorts the ids so two
 * concurrent gifts between the same pair can't deadlock.
 *
 * Rule 3: the two wallets never mix. PURCHASED is spend-only. EARNED (beans)
 * is the only cashable balance. The only places a purchased diamond becomes an
 * earned bean are a gift to a *different* user and a game win.
 */
import { Prisma, type LedgerKind, type Wallet } from '@prisma/client';
import { AppError } from './http';

export type Tx = Prisma.TransactionClient;

/** Spends that count towards the sender level. */
const SPEND_KINDS: ReadonlySet<LedgerKind> = new Set<LedgerKind>([
  'GIFT_SENT',
  'GAME_WAGER',
  'CLAN_CREATE_FEE',
]);

/** Credits that count towards the host level. A cash-out refund does not. */
const EARNING_KINDS: ReadonlySet<LedgerKind> = new Set<LedgerKind>(['GIFT_RECEIVED', 'GAME_WIN']);

const BALANCE_COLUMN: Record<Wallet, 'purchasedDiamonds' | 'earnedDiamonds'> = {
  PURCHASED: 'purchasedDiamonds',
  EARNED: 'earnedDiamonds',
};

export type AdjustWalletArgs = {
  userId: string;
  wallet: Wallet;
  /** Signed and non-zero. Negative debits. */
  amount: number;
  kind: LedgerKind;
  refType?: string;
  refId?: string;
  memo?: string;
  /**
   * Set when the caller already took the row lock through lockUsers(), so we
   * don't re-lock (harmless, but a wasted round trip).
   */
  preLocked?: boolean;
};

export type AdjustWalletResult = {
  userId: string;
  wallet: Wallet;
  amount: number;
  balanceAfter: number;
  ledgerEntryId: string;
};

/**
 * Take a row lock on each user, in a stable order.
 *
 * One statement per id rather than a single `IN (...) FOR UPDATE`: Postgres
 * doesn't promise lock acquisition follows an ORDER BY inside one statement,
 * and the stable order is the whole point.
 */
export async function lockUsers(tx: Tx, userIds: readonly string[]): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  for (const id of ids) {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM users WHERE id = ${id} FOR UPDATE`,
    );
    if (rows.length === 0) throw AppError.notFound('Account not found');
  }
}

/**
 * Move an amount in or out of one wallet and record it.
 *
 * Throws AppError.insufficient (402) rather than letting a balance go
 * negative, so an overspend surfaces as a clean client error and rolls the
 * surrounding transaction back.
 */
export async function adjustWallet(tx: Tx, args: AdjustWalletArgs): Promise<AdjustWalletResult> {
  const { userId, wallet, amount, kind, refType, refId, memo } = args;

  if (!Number.isInteger(amount)) {
    throw new Error(`adjustWallet: amount must be an integer, got ${amount}`);
  }
  if (amount === 0) {
    throw new Error('adjustWallet: amount must not be zero');
  }

  if (!args.preLocked) await lockUsers(tx, [userId]);

  const column = BALANCE_COLUMN[wallet];
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, purchasedDiamonds: true, earnedDiamonds: true },
  });
  if (!user) throw AppError.notFound('Account not found');

  const current = user[column];
  const balanceAfter = current + amount;
  if (balanceAfter < 0) {
    throw AppError.insufficient(
      wallet === 'PURCHASED'
        ? 'Not enough diamonds. Top up to keep going.'
        : 'Not enough beans for that.',
    );
  }

  // Lifetime counters that drive the level bands. Explicit kinds only, so a
  // cash-out hold or an admin correction never moves them.
  const lifetime: { totalSpent?: { increment: number }; totalEarned?: { increment: number } } = {};
  if (wallet === 'PURCHASED' && amount < 0 && SPEND_KINDS.has(kind)) {
    lifetime.totalSpent = { increment: -amount };
  }
  if (wallet === 'EARNED' && amount > 0 && EARNING_KINDS.has(kind)) {
    lifetime.totalEarned = { increment: amount };
  }

  await tx.user.update({
    where: { id: userId },
    data: { [column]: { increment: amount }, ...lifetime },
  });

  const entry = await tx.ledgerEntry.create({
    data: { userId, wallet, kind, amount, balanceAfter, refType, refId, memo },
    select: { id: true },
  });

  return { userId, wallet, amount, balanceAfter, ledgerEntryId: entry.id };
}

/**
 * Credit a clan for its member's spending. No-op for a user with no clan.
 * Locks the clan row first so concurrent gifts from clan-mates serialise.
 */
export async function addClanPoints(tx: Tx, userId: string, points: number): Promise<number> {
  if (points <= 0) return 0;
  if (!Number.isInteger(points)) throw new Error('addClanPoints: points must be an integer');

  const membership = await tx.clanMember.findUnique({
    where: { userId },
    select: { id: true, clanId: true },
  });
  if (!membership) return 0;

  await tx.$queryRaw(Prisma.sql`SELECT id FROM clans WHERE id = ${membership.clanId} FOR UPDATE`);

  await tx.clan.update({
    where: { id: membership.clanId },
    data: { points: { increment: points } },
  });
  await tx.clanMember.update({
    where: { id: membership.id },
    data: { points: { increment: points } },
  });

  return points;
}

/** Lock a clan row — used by the join route to hold the 15-member cap. */
export async function lockClan(tx: Tx, clanId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM clans WHERE id = ${clanId} FOR UPDATE`,
  );
  if (rows.length === 0) throw AppError.notFound('Clan not found');
}

/** Current balances, after any pending write in this transaction. */
export async function readBalances(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { purchasedDiamonds: true, earnedDiamonds: true, totalSpent: true, totalEarned: true },
  });
  if (!user) throw AppError.notFound('Account not found');
  return user;
}
