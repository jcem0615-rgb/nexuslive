/**
 * The /admin and /api/admin gate (rule 4, first of two).
 *
 * Runs on the edge, so it can only check the JWT — it cannot touch the
 * database. That is why every /api/admin/* handler calls requireMasterAdmin()
 * as well, which re-reads the row. This layer exists to keep non-owners from
 * ever rendering the portal shell.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isMasterAdmin, verifySession } from './lib/session';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const owner = isMasterAdmin(claims);

  if (pathname.startsWith('/api/admin')) {
    if (!owner) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Master Admin only' } },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    if (!owner) {
      // Signed in but not the owner: send them home rather than to a login
      // loop. Not signed in: login, and come back here afterwards.
      const url = req.nextUrl.clone();
      if (claims) {
        url.pathname = '/';
        url.search = '';
      } else {
        url.pathname = '/login';
        url.search = `?next=${encodeURIComponent(pathname + search)}`;
      }
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
