/**
 * Server-side identity. Everything here re-reads the database, so a user who
 * was locked or demoted after their cookie was issued is caught immediately.
 */
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { AppError } from './http';
import { SESSION_COOKIE, isMasterAdmin, verifySession, type SessionClaims } from './session';
import { isRestricted } from './moderation';

export const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  gender: true,
  country: true,
  role: true,
  phone: true,
  purchasedDiamonds: true,
  earnedDiamonds: true,
  totalSpent: true,
  totalEarned: true,
  isLocked: true,
  lockedReason: true,
  strikeCount: true,
  restrictedUntil: true,
  bannedAt: true,
  lastDailyBonusAt: true,
  createdAt: true,
} as const;

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  gender: 'UNSPECIFIED' | 'FEMALE' | 'MALE' | 'OTHER';
  country: string | null;
  role: 'USER' | 'HOST' | 'MODERATOR' | 'MASTER_ADMIN';
  phone: string | null;
  purchasedDiamonds: number;
  earnedDiamonds: number;
  totalSpent: number;
  totalEarned: number;
  isLocked: boolean;
  lockedReason: string | null;
  strikeCount: number;
  restrictedUntil: Date | null;
  bannedAt: Date | null;
  lastDailyBonusAt: Date | null;
  createdAt: Date;
};

export async function readClaims(): Promise<SessionClaims | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** The signed-in user, or null. Never throws — use it on public pages. */
export async function getUser(): Promise<SessionUser | null> {
  const claims = await readClaims();
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: USER_SELECT });
  return user ?? null;
}

/** The signed-in user, or a 401. Locked accounts get a 403. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw AppError.unauthorized();
  if (user.isLocked) {
    throw AppError.forbidden(user.lockedReason ?? 'This account is locked. Contact support.');
  }
  return user;
}

/**
 * A signed-in user who is also allowed to take part in public life — going
 * live, taking a seat, chatting, gifting.
 *
 * A restriction from the strike ladder blocks exactly those. It deliberately
 * does not block the wallet: the money is still theirs, and holding it hostage
 * is not what the policy says happens. Only a permanent ban touches balances.
 */
export async function requireUnrestricted(): Promise<SessionUser> {
  const user = await requireUser();
  if (isRestricted(user)) {
    const until = user.restrictedUntil!;
    throw new AppError(
      403,
      `Your account is restricted until ${until.toISOString()} for breaking the content policy.`,
      'restricted',
      { restrictedUntil: until.toISOString(), strikeCount: user.strikeCount },
    );
  }
  return user;
}

/**
 * Rule 4, second gate. The middleware already checked the JWT, but every
 * /api/admin/* handler must call this too: it re-reads the row and re-applies
 * the sole-owner test against MASTER_ADMIN_EMAIL.
 */
export async function requireMasterAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isMasterAdmin(user)) throw AppError.forbidden('Master Admin only');
  return user;
}

/** True when a host owns the stream, or the owner is looking. */
export function canModerateStream(user: SessionUser, hostId: string): boolean {
  return user.id === hostId || user.role === 'MODERATOR' || isMasterAdmin(user);
}
