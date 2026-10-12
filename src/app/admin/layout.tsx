import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isMasterAdmin } from '@/lib/session';
import { Logo } from '@/components/Logo';
import { AdminNav } from './AdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { title: { default: 'Portal', template: '%s · Portal' } };

/**
 * Third gate. src/middleware.ts checks the JWT before this renders, and every
 * /api/admin handler re-checks the database — this one keeps the portal shell
 * itself from rendering for anyone but the owner, even if the matcher ever
 * stops covering a path.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!isMasterAdmin(user)) notFound();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2.5" aria-label="Portal home">
            <Logo size={28} />
            <span className="text-sm font-extrabold tracking-tight text-white">
              Master Admin
            </span>
          </Link>
          <span className="pill ml-1 bg-live/15 text-live">Owner</span>
          <Link
            href="/"
            className="ml-auto text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Back to app
          </Link>
        </div>
        <AdminNav />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
