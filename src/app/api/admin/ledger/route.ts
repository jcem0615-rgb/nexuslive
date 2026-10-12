import { requireMasterAdmin } from '@/lib/auth';
import { intParam, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import type { LedgerKind, Wallet } from '@prisma/client';

export const runtime = 'nodejs';

const WALLETS = ['PURCHASED', 'EARNED'] as const;

export const GET = route(async (req) => {
  await requireMasterAdmin();

  const url = new URL(req.url);
  const take = intParam(url, 'limit', 50, 200);
  const userId = url.searchParams.get('userId') ?? undefined;
  const kind = (url.searchParams.get('kind') as LedgerKind | null) ?? undefined;
  const walletRaw = url.searchParams.get('wallet');
  const wallet = WALLETS.find((w) => w === walletRaw) as Wallet | undefined;

  const entries = await prisma.ledgerEntry.findMany({
    where: { ...(userId ? { userId } : {}), ...(kind ? { kind } : {}), ...(wallet ? { wallet } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
    include: { user: { select: { username: true, displayName: true } } },
  });

  return ok({ entries });
});
