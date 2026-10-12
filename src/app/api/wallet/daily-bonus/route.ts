import { requireUser } from '@/lib/auth';
import { AppError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { DAILY_BONUS_DIAMONDS } from '@/lib/economy';

export const runtime = 'nodejs';

/** Same UTC day = already claimed. */
function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export const POST = route(async () => {
  const user = await requireUser();
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Re-read under the row lock adjustWallet is about to take, so two taps
    // can't both pass the check.
    const fresh = await tx.user.findUnique({
      where: { id: user.id },
      select: { lastDailyBonusAt: true },
    });
    if (fresh?.lastDailyBonusAt && sameUtcDay(fresh.lastDailyBonusAt, now)) {
      throw AppError.conflict('You have already claimed today. Come back tomorrow.');
    }

    await tx.user.update({ where: { id: user.id }, data: { lastDailyBonusAt: now } });

    return adjustWallet(tx, {
      userId: user.id,
      wallet: 'PURCHASED',
      amount: DAILY_BONUS_DIAMONDS,
      kind: 'DAILY_BONUS',
      memo: 'Daily check-in',
    });
  });

  return ok({ credited: DAILY_BONUS_DIAMONDS, balanceAfter: result.balanceAfter });
});
