import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { resetPasswordSchema } from '@/lib/validators';
import { BCRYPT_COST, PASSWORD_RESET_MAX_ATTEMPTS } from '@/lib/economy';

export const runtime = 'nodejs';

export const POST = route(async (req) => {
  const { email, otp, password } = await parseJson(req, resetPasswordSchema);
  const invalid = AppError.badRequest('That code is wrong or has expired');

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw invalid;

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset) throw invalid;

  if (reset.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    throw AppError.tooMany('Too many tries. Request a new code.');
  }

  if (!(await bcrypt.compare(otp, reset.otpHash))) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);

  return ok({ message: 'Password updated. Sign in with it now.' });
});
