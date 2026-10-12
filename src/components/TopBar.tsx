import Link from 'next/link';
import { Wordmark } from './Logo';
import { Avatar, BeanPill, DiamondPill } from './ui';
import type { SessionUser } from '@/lib/auth';

/**
 * Header with the wordmark on the left and, once signed in, the two balances
 * — deliberately side by side, because they are not interchangeable: diamonds
 * are spend-only, beans are what you can cash out.
 */
export function TopBar({ user, isOwner = false }: { user: SessionUser | null; isOwner?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0" aria-label="Nexus Live home">
          <Wordmark size={30} pulse />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/wallet" className="hidden gap-2 sm:flex" aria-label="Your wallet">
                <DiamondPill amount={user.purchasedDiamonds} />
                <BeanPill amount={user.earnedDiamonds} />
              </Link>
              {isOwner && (
                <Link href="/admin" className="pill bg-nexus-500/20 text-nexus-200 hover:bg-nexus-500/30">
                  Portal
                </Link>
              )}
              <Link href={`/u/${user.username}`} aria-label="Your profile">
                <Avatar name={user.displayName} src={user.avatarUrl} size={32} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-3 py-2 text-xs">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary px-3 py-2 text-xs">
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
