import { requireMasterAdmin } from '@/lib/auth';
import { AppError, clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { adminAdjustSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * A manual correction. It goes through adjustWallet like everything else
 * (rule 1), so it shows up in the ledger with a memo, and the audit row lands
 * in the same transaction (rule 5).
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { wallet, amount, memo } = await parseJson(req, adminAdjustSchema);

  const target = await prisma.user.findUnique({ where: { id }, select: { username: true } });
  if (!target) throw AppError.notFound('No such account');

  const result = await prisma.$transaction(async (tx) => {
    const adjusted = await adjustWallet(tx, {
      userId: id,
      wallet,
      amount,
      kind: amount > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      refType: 'AdminAdjustment',
      refId: admin.id,
      memo,
    });

    await writeAudit(tx, {
      actorId: admin.id,
      action: amount > 0 ? 'wallet.credit' : 'wallet.debit',
      targetType: 'User',
      targetId: id,
      metadata: {
        username: target.username,
        wallet,
        amount,
        memo,
        balanceAfter: adjusted.balanceAfter,
      },
      ip: clientIp(req),
    });

    return adjusted;
  });

  return ok({ wallet, amount, balanceAfter: result.balanceAfter });
});
