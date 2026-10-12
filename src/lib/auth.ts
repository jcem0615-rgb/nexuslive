/**
 * Server-side identity. Everything here re-reads the database, so a user who
 * was locked or demoted after their cookie was issued is caught immediately.
 */
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { AppError } from './http';
import { SESSION_COOKIE, isMasterAdmin, verifySession, type SessionClaims } from './session';

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
  purchasedDiamonds: true,
  earnedDiamonds: true,
  totalSpent: true,
  totalEarned: true,
  isLocked: true,
  lockedReason: true,
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
  purchasedDiamonds: number;
  earnedDiamonds: number;
  totalSpent: number;
  totalEarned: number;
  isLocked: boolean;
  lockedReason: string | null;
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
