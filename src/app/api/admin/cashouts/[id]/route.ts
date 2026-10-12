import { requireMasterAdmin } from '@/lib/auth';
import { AppError, clientIp, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adjustWallet } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { adminCashoutSchema } from '@/lib/validators';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Review a payout.
 *
 *   APPROVE   PENDING  -> APPROVED   (beans already held at request time)
 *   MARK_PAID APPROVED -> PAID
 *   REJECT    either    -> REJECTED  and the held beans go back
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireMasterAdmin();
  const { id } = await params;
  const { action, note } = await parseJson(req, adminCashoutSchema);

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.cashoutRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, beans: true, status: true, netCents: true },
    });
    if (!request) throw AppError.notFound('No such request');

    const now = new Date();

    if (action === 'APPROVE') {
      if (request.status !== 'PENDING') throw AppError.conflict('That request is not pending');
      const result = await tx.cashoutRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedById: admin.id, reviewedAt: now, reviewNote: note },
      });
      await writeAudit(tx, {
        actorId: admin.id,
        action: 'cashout.approve',
        targetType: 'CashoutRequest',
        targetId: id,
        metadata: { beans: request.beans, netCents: request.netCents, note: note ?? null },
        ip: clientIp(req),
      });
      return result;
    }

    if (action === 'MARK_PAID') {
      if (request.status !== 'APPROVED') throw AppError.conflict('Approve it first');
      const result = await tx.cashoutRequest.update({
        where: { id },
        data: { status: 'PAID', paidAt: now, reviewedById: admin.id, reviewNote: note },
      });
      await writeAudit(tx, {
        actorId: admin.id,
        action: 'cashout.paid',
        targetType: 'CashoutRequest',
        targetId: id,
        metadata: { beans: request.beans, netCents: request.netCents, note: note ?? null },
        ip: clientIp(req),
      });
      return result;
    }

    if (request.status === 'PAID' || request.status === 'REJECTED') {
      throw AppError.conflict('That request is already closed');
    }

    // Rejected: hand the beans back through the wallet so the ledger balances.
    await adjustWallet(tx, {
      userId: request.userId,
      wallet: 'EARNED',
      amount: request.beans,
      kind: 'CASHOUT_REFUND',
      refType: 'CashoutRequest',
      refId: id,
      memo: note ?? 'Cash-out rejected',
    });

    const result = await tx.cashoutRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: admin.id, reviewedAt: now, reviewNote: note },
    });
    await writeAudit(tx, {
      actorId: admin.id,
      action: 'cashout.reject',
      targetType: 'CashoutRequest',
      targetId: id,
      metadata: { beans: request.beans, refunded: true, note: note ?? null },
      ip: clientIp(req),
    });
    return result;
  });

  return ok({ request: updated });
});
