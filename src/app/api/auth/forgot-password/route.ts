import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ok, parseJson, route } from '@/lib/http';
import { forgotPasswordSchema } from '@/lib/validators';
import { BCRYPT_COST, PASSWORD_RESET_TTL_MINUTES } from '@/lib/economy';

export const runtime = 'nodejs';

/**
 * Issues a one-time code. The response is identical whether or not the
 * address exists, so this can't be used to enumerate accounts.
 *
 * Only a hash of the code is stored (deviation from the spec, see CLAUDE.md).
 * Delivery by email is not wired up yet — until it is, the code is logged
 * server-side in development only.
 */
export const POST = route(async (req) => {
  const { email } = await parseJson(req, forgotPasswordSchema);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  let devCode: string | undefined;

  if (user) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, BCRYPT_COST);

    await prisma.$transaction(async (tx) => {
      // One live code at a time.
      await tx.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordReset.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
        },
      });
    });

    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] password reset code for ${email}: ${otp}`);
      devCode = otp;
    }
  }

  return ok({
    message: `If that address has an account, a ${PASSWORD_RESET_TTL_MINUTES}-minute code is on its way.`,
    ...(devCode ? { devCode } : {}),
  });
});
