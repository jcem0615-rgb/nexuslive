/**
 * JWT session handling. Edge-safe on purpose: this module is imported by
 * src/middleware.ts, so it may only use Web Crypto (via jose) — no Prisma, no
 * bcrypt, no Node built-ins.
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'nexus_session';

export type SessionRole = 'USER' | 'HOST' | 'MODERATOR' | 'MASTER_ADMIN';

export type SessionClaims = {
  sub: string;
  email: string;
  username: string;
  role: SessionRole;
};

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  }
  return new TextEncoder().encode(secret);
}

function ttlHours(): number {
  const parsed = Number(process.env.SESSION_TTL_HOURS ?? '168');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 168;
}

export function sessionMaxAge(): number {
  return Math.floor(ttlHours() * 3600);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, username: claims.username, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('nexus-live')
    .setAudience('nexus-live-app')
    .setExpirationTime(`${ttlHours()}h`)
    .sign(secretKey());
}

/** Returns null for anything we would not act on — expired, forged, malformed. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'nexus-live',
      audience: 'nexus-live-app',
      algorithms: ['HS256'],
    });
    const { sub, email, username, role } = payload as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof email !== 'string' || typeof username !== 'string') {
      return null;
    }
    if (role !== 'USER' && role !== 'HOST' && role !== 'MODERATOR' && role !== 'MASTER_ADMIN') {
      return null;
    }
    return { sub, email, username, role };
  } catch {
    return null;
  }
}

/**
 * The sole-owner lock (rule 4). Being MASTER_ADMIN is not enough on its own —
 * the email has to match MASTER_ADMIN_EMAIL exactly, case-insensitively.
 * Used by the middleware on JWT claims and by requireMasterAdmin() on a fresh
 * database row.
 */
export function isMasterAdmin(subject: { email: string; role: string } | null | undefined): boolean {
  if (!subject) return false;
  const owner = process.env.MASTER_ADMIN_EMAIL;
  if (!owner) return false;
  return subject.role === 'MASTER_ADMIN' && subject.email.toLowerCase() === owner.toLowerCase();
}

export function sessionCookieOptions(maxAge = sessionMaxAge()) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
