import { requireUser } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { hostLevel, quoteCashout, senderLevel } from '@/lib/economy';

export const runtime = 'nodejs';

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const take = intParam(url, 'limit', 25, 100);

  const entries = await prisma.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      wallet: true,
      kind: true,
      amount: true,
      balanceAfter: true,
      memo: true,
      createdAt: true,
    },
  });

  return ok({
    balances: {
      purchasedDiamonds: user.purchasedDiamonds,
      earnedDiamonds: user.earnedDiamonds,
    },
    lifetime: { totalSpent: user.totalSpent, totalEarned: user.totalEarned },
    levels: { sender: senderLevel(user.totalSpent), host: hostLevel(user.totalEarned) },
    cashoutQuote: quoteCashout(user.earnedDiamonds),
    entries,
  });
});
