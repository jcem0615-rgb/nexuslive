import { randomInt } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { ROLL_SPACE, findGame, resolveRound } from '@/lib/economy';
import { playGameSchema } from '@/lib/validators';

export const runtime = 'nodejs';

/**
 * Rule 7: the outcome is drawn here, with crypto.randomInt, and the raw draw
 * is stored on the round so any payout can be re-checked later. The client
 * sends at most a pick — never a result.
 *
 * The wager comes out of purchased diamonds; winnings land in beans. That is
 * the second of the two sanctioned crossings between the wallets (rule 3).
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { game: gameKey, pick } = await parseJson(req, playGameSchema);

  const game = findGame(gameKey);
  if (!game) throw AppError.badRequest('Unknown game');

  if (game.pickRange !== undefined) {
    if (pick === undefined) throw AppError.badRequest(`Pick a number from 1 to ${game.pickRange}`);
    if (pick < 1 || pick > game.pickRange) {
      throw AppError.badRequest(`Pick a number from 1 to ${game.pickRange}`);
    }
  }

  const roll = randomInt(0, ROLL_SPACE);
  const { outcome, drawn } = resolveRound(game, roll, pick);

  const result = await prisma.$transaction(async (tx) => {
    const wager = await adjustWallet(tx, {
      userId: user.id,
      wallet: 'PURCHASED',
      amount: -game.costDiamonds,
      kind: 'GAME_WAGER',
      refType: 'Game',
      refId: game.key,
      memo: `${game.name} round`,
    });

    let beanBalance: number | null = null;
    if (outcome.payoutBeans > 0) {
      const win = await adjustWallet(tx, {
        userId: user.id,
        wallet: 'EARNED',
        amount: outcome.payoutBeans,
        kind: 'GAME_WIN',
        refType: 'Game',
        refId: game.key,
        memo: `${game.name} — ${outcome.label}`,
      });
      beanBalance = win.balanceAfter;
    }

    const round = await tx.gameRound.create({
      data: {
        userId: user.id,
        game: game.key,
        wagerDiamonds: game.costDiamonds,
        serverRoll: roll,
        pick: pick ?? null,
        outcomeKey: outcome.key,
        payoutBeans: outcome.payoutBeans,
      },
      select: { id: true, createdAt: true },
    });

    return { round, diamondBalance: wager.balanceAfter, beanBalance };
  });

  const fresh = result.beanBalance;

  return ok(
    {
      roundId: result.round.id,
      game: game.key,
      outcome: { key: outcome.key, label: outcome.label, payoutBeans: outcome.payoutBeans },
      drawn: drawn ?? null,
      pick: pick ?? null,
      balances: {
        purchasedDiamonds: result.diamondBalance,
        ...(fresh !== null ? { earnedDiamonds: fresh } : {}),
      },
    },
    201,
  );
});
