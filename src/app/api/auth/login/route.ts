import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session';
import { loginSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export const POST = route(async (req) => {
  const { email, password } = await parseJson(req, loginSchema);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      role: true,
      isLocked: true,
      lockedReason: true,
    },
  });

  // Same message either way, and we still hash, so a missing account and a
  // wrong password cost the same and look the same.
  const fallback = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const matches = await bcrypt.compare(password, user?.passwordHash ?? fallback);
  if (!user || !matches) throw AppError.unauthorized('Email or password is incorrect');

  if (user.isLocked) {
    throw AppError.forbidden(user.lockedReason ?? 'This account is locked. Contact support.');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = await signSession({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok({ user: { id: user.id, username: user.username, role: user.role } });
});
