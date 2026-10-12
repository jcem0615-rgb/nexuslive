import { requireMasterAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { BEANS_PER_USD, GAME_LIST, expectedPayout, formatCents } from '@/lib/economy';

export const runtime = 'nodejs';

export const GET = route(async () => {
  await requireMasterAdmin();

  const dayAgo = new Date(Date.now() - 86_400_000);

  const [
    users,
    newUsers,
    liveStreams,
    lockedUsers,
    diamondsOut,
    beansOut,
    giftVolume,
    giftVolumeToday,
    purchases,
    pendingCashouts,
    paidCashouts,
    gameRounds,
    openReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.stream.count({ where: { status: 'LIVE' } }),
    prisma.user.count({ where: { isLocked: true } }),
    prisma.user.aggregate({ _sum: { purchasedDiamonds: true } }),
    prisma.user.aggregate({ _sum: { earnedDiamonds: true } }),
    prisma.giftTransaction.aggregate({ _sum: { diamondCost: true, beansCredited: true } }),
    prisma.giftTransaction.aggregate({
      where: { createdAt: { gte: dayAgo } },
      _sum: { diamondCost: true },
    }),
    prisma.diamondPurchase.aggregate({
      where: { status: 'PAID' },
      _sum: { amountCents: true, diamonds: true },
      _count: true,
    }),
    prisma.cashoutRequest.aggregate({
      where: { status: { in: ['PENDING', 'APPROVED'] } },
      _sum: { netCents: true, beans: true },
      _count: true,
    }),
    prisma.cashoutRequest.aggregate({ where: { status: 'PAID' }, _sum: { netCents: true } }),
    prisma.gameRound.aggregate({ _sum: { wagerDiamonds: true, payoutBeans: true }, _count: true }),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ]);

  const giftedDiamonds = giftVolume._sum.diamondCost ?? 0;
  const giftedBeans = giftVolume._sum.beansCredited ?? 0;

  return ok({
    users: { total: users, newToday: newUsers, locked: lockedUsers },
    streams: { live: liveStreams },
    float: {
      purchasedDiamonds: diamondsOut._sum.purchasedDiamonds ?? 0,
      earnedBeans: beansOut._sum.earnedDiamonds ?? 0,
      /** What the outstanding bean float would cost to pay out. */
      beanLiabilityCents: Math.floor(((beansOut._sum.earnedDiamonds ?? 0) * 100) / BEANS_PER_USD),
    },
    gifting: {
      diamonds: giftedDiamonds,
      beans: giftedBeans,
      diamondsToday: giftVolumeToday._sum.diamondCost ?? 0,
      /** Diamonds gifted that the platform kept rather than paying out as beans. */
      platformCut: giftedDiamonds - giftedBeans,
    },
    revenue: {
      orders: purchases._count,
      grossCents: purchases._sum.amountCents ?? 0,
      gross: formatCents(purchases._sum.amountCents ?? 0),
      diamondsSold: purchases._sum.diamonds ?? 0,
    },
    cashouts: {
      pendingCount: pendingCashouts._count,
      pendingBeans: pendingCashouts._sum.beans ?? 0,
      pendingNetCents: pendingCashouts._sum.netCents ?? 0,
      paidNetCents: paidCashouts._sum.netCents ?? 0,
    },
    games: {
      rounds: gameRounds._count,
      wagered: gameRounds._sum.wagerDiamonds ?? 0,
      paidOut: gameRounds._sum.payoutBeans ?? 0,
      table: GAME_LIST.map((game) => ({
        key: game.key,
        cost: game.costDiamonds,
        expectedBeans: Number(expectedPayout(game).toFixed(2)),
      })),
    },
    moderation: { openReports },
  });
});
