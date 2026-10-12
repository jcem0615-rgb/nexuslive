import { requireUser } from '@/lib/auth';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { MAX_PENDING_CASHOUTS, MIN_CASHOUT_BEANS, quoteCashout } from '@/lib/economy';
import { cashoutSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const user = await requireUser();
  const requests = await prisma.cashoutRequest.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: 'desc' },
    take: 20,
  });
  return ok({
    requests,
    balance: user.earnedDiamonds,
    quote: quoteCashout(user.earnedDiamonds),
    minimum: MIN_CASHOUT_BEANS,
  });
});

/**
 * Beans leave the wallet the moment the request is filed, so the same balance
 * can't be withdrawn twice while a request sits in review. A rejection pays
 * them back (CASHOUT_REFUND), which is why the refund kind is excluded from
 * the lifetime-earned counter.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { beans, method, payoutHandle } = await parseJson(req, cashoutSchema);

  const quote = quoteCashout(beans);
  if (quote.netCents <= 0) throw AppError.badRequest('That amount is too small to pay out');

  const request = await prisma.$transaction(async (tx) => {
    const pending = await tx.cashoutRequest.count({
      where: { userId: user.id, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (pending >= MAX_PENDING_CASHOUTS) {
      throw AppError.conflict('You already have a cash-out in review');
    }

    // adjustWallet refuses to go negative, so this is also the balance check.
    await adjustWallet(tx, {
      userId: user.id,
      wallet: 'EARNED',
      amount: -beans,
      kind: 'CASHOUT_HOLD',
      memo: `Cash-out via ${method}`,
    });

    return tx.cashoutRequest.create({
      data: {
        userId: user.id,
        beans,
        grossCents: quote.grossCents,
        feeCents: quote.feeCents,
        netCents: quote.netCents,
        method,
        payoutHandle,
      },
    });
  });

  return ok({ request }, 201);
});
