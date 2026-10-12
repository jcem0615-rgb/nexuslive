import { cookies } from 'next/headers';
import { ok, route } from '@/lib/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export const runtime = 'nodejs';

export const POST = route(async () => {
  (await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return ok({ ok: true });
});
