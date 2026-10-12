import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AppError, ok, parseJson, route } from '@/lib/http';
import { adjustWallet } from '@/lib/wallet';
import { signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';
import { signupSchema } from '@/lib/validators';
import { normalisePhone } from '@/lib/phone';
import { BCRYPT_COST, SIGNUP_BONUS_DIAMONDS } from '@/lib/economy';

export const runtime = 'nodejs';

export const POST = route(async (req) => {
  const body = await parseJson(req, signupSchema);

  // Rule 4: the owner's address can never be claimed through signup.
  const ownerEmail = process.env.MASTER_ADMIN_EMAIL?.toLowerCase();
  if (ownerEmail && body.email === ownerEmail) {
    throw AppError.conflict('That email is already registered');
  }

  // One email, one number, one username — one account.
  const phone = normalisePhone(body.phone);

  const clash = await prisma.user.findFirst({
    where: { OR: [{ email: body.email }, { username: body.username }, { phone }] },
    select: { email: true, username: true, phone: true },
  });
  if (clash) {
    if (clash.email === body.email) throw AppError.conflict('That email is already registered');
    if (clash.phone === phone) throw AppError.conflict('That phone number is already registered');
    throw AppError.conflict('That username is taken');
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash,
        displayName: body.displayName,
        phone,
        gender: body.gender ?? 'UNSPECIFIED',
        country: body.country,
        // Rule 4: hardcoded. Only the seed may create a MASTER_ADMIN.
        role: 'USER',
      },
      select: { id: true, email: true, username: true, displayName: true, role: true },
    });

    // The welcome bonus goes through the wallet so it lands in the ledger.
    await adjustWallet(tx, {
      userId: created.id,
      wallet: 'PURCHASED',
      amount: SIGNUP_BONUS_DIAMONDS,
      kind: 'SIGNUP_BONUS',
      memo: 'Welcome to Nexus Live',
    });

    return created;
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: 'USER',
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok(
    {
      user: { id: user.id, username: user.username, displayName: user.displayName },
      bonus: SIGNUP_BONUS_DIAMONDS,
    },
    201,
  );
});
