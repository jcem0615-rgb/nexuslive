import { requireUser } from '@/lib/auth';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { addClanPoints, adjustWallet, lockUsers } from '@/lib/wallet';
import { beansForGift, clanPointsForGift, findGift } from '@/lib/economy';
import { sendGiftSchema } from '@/lib/validators';

export const runtime = 'nodejs';

/**
 * The one place a purchased diamond becomes an earned bean (rule 3), and only
 * ever between two different users.
 *
 * Both rows are locked up front through lockUsers (rule 2) so two people
 * gifting each other at the same moment can't deadlock.
 */
export const POST = route(async (req) => {
  const sender = await requireUser();
  const { giftCode, receiverId, streamId, quantity } = await parseJson(req, sendGiftSchema);

  const gift = findGift(giftCode);
  if (!gift) throw AppError.badRequest('Unknown gift');
  if (receiverId === sender.id) throw AppError.badRequest('You cannot gift yourself');

  const diamondCost = gift.diamonds * quantity;
  const beans = beansForGift(diamondCost);
  const clanPoints = clanPointsForGift(diamondCost);

  const result = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [sender.id, receiverId]);

    const receiver = await tx.user.findUnique({
      where: { id: receiverId },
      select: { id: true, username: true, displayName: true, isLocked: true },
    });
    if (!receiver) throw AppError.notFound('That person is not here any more');
    if (receiver.isLocked) throw AppError.forbidden('That account cannot receive gifts');

    if (streamId) {
      const stream = await tx.stream.findUnique({
        where: { id: streamId },
        select: { id: true, hostId: true, status: true },
      });
      if (!stream || stream.status !== 'LIVE') throw AppError.badRequest('That stream has ended');
      if (stream.hostId !== receiverId) throw AppError.badRequest('That host is not on this stream');
    }

    const spend = await adjustWallet(tx, {
      userId: sender.id,
      wallet: 'PURCHASED',
      amount: -diamondCost,
      kind: 'GIFT_SENT',
      refType: 'Gift',
      refId: gift.code,
      memo: `${quantity}x ${gift.name} to @${receiver.username}`,
      preLocked: true,
    });

    const credit = await adjustWallet(tx, {
      userId: receiverId,
      wallet: 'EARNED',
      amount: beans,
      kind: 'GIFT_RECEIVED',
      refType: 'Gift',
      refId: gift.code,
      memo: `${quantity}x ${gift.name} from @${sender.username}`,
      preLocked: true,
    });

    const awarded = await addClanPoints(tx, sender.id, clanPoints);

    const transaction = await tx.giftTransaction.create({
      data: {
        senderId: sender.id,
        receiverId,
        streamId,
        giftCode: gift.code,
        quantity,
        diamondCost,
        beansCredited: beans,
        clanPoints: awarded,
      },
    });

    if (streamId) {
      await tx.stream.update({
        where: { id: streamId },
        data: { beansEarned: { increment: beans } },
      });
    }

    return { transaction, senderBalance: spend.balanceAfter, receiverBalance: credit.balanceAfter };
  });

  return ok(
    {
      gift: { code: gift.code, name: gift.name, glyph: gift.glyph, fullscreen: gift.fullscreen },
      quantity,
      diamondCost,
      beansCredited: beans,
      clanPoints: result.transaction.clanPoints,
      balance: result.senderBalance,
      transactionId: result.transaction.id,
    },
    201,
  );
});
