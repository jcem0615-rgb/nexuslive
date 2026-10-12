import { requireUser } from '@/lib/auth';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { findPack, packTotalDiamonds } from '@/lib/economy';
import { purchaseSchema } from '@/lib/validators';

export const runtime = 'nodejs';

/**
 * Top-up. A real payment provider is not installed yet, so this records the
 * intent and stops.
 *
 * Outside production the order settles immediately, which is what makes the
 * economy testable end to end. It must never self-settle in production — that
 * would be a free diamond tap — so the guard below is deliberate, not a TODO.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { packCode } = await parseJson(req, purchaseSchema);

  const pack = findPack(packCode);
  if (!pack) throw AppError.badRequest('Unknown pack');

  const diamonds = packTotalDiamonds(pack);
  const autoSettle = process.env.NODE_ENV !== 'production';

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.diamondPurchase.create({
      data: {
        userId: user.id,
        packCode: pack.code,
        diamonds,
        amountCents: pack.priceCents,
        provider: autoSettle ? 'sandbox' : 'manual',
        providerRef: `${autoSettle ? 'sbx' : 'man'}_${Date.now()}_${user.id.slice(-6)}`,
        status: autoSettle ? 'PAID' : 'PENDING',
        settledAt: autoSettle ? new Date() : null,
      },
    });

    if (autoSettle) {
      await adjustWallet(tx, {
        userId: user.id,
        wallet: 'PURCHASED',
        amount: diamonds,
        kind: 'PURCHASE',
        refType: 'DiamondPurchase',
        refId: created.id,
        memo: `${pack.code} pack`,
      });
    }

    return created;
  });

  if (!autoSettle) {
    return ok(
      {
        purchaseId: purchase.id,
        status: purchase.status,
        message: 'Checkout is not connected yet. Your order is recorded as pending.',
      },
      202,
    );
  }

  return ok({ purchaseId: purchase.id, status: purchase.status, credited: diamonds }, 201);
});
