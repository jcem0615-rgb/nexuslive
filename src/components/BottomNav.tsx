'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/live', label: 'Live', icon: LiveIcon },
  { href: '/games', label: 'Games', icon: GamesIcon },
  { href: '/clans', label: 'Clans', icon: ClansIcon },
  { href: '/wallet', label: 'Wallet', icon: WalletIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // The portal, the auth screens and a full-screen stream get the whole viewport.
  const bare = ['/login', '/signup', '/forgot-password', '/offline'];
  if (bare.includes(pathname)) return null;
  if (pathname.startsWith('/admin') || /^\/live\/[^/]+$/.test(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/85 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-nexus-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon active={active} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { active: boolean };
const base = 'h-5 w-5';

function HomeIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function LiveIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 16.6a6.5 6.5 0 0 0 0-9.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {active && (
        <path d="M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 19.5a10.6 10.6 0 0 0 0-15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
      )}
    </svg>
  );
}

function GamesIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="6.5" width="19" height="11" rx="4.5" stroke="currentColor" strokeWidth="1.8" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
      <path d="M7 10v4M5 12h4M15.5 11h.01M18 13.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClansIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 4h14v8.2c0 3-2.6 5.4-7 7.8-4.4-2.4-7-4.8-7-7.8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
      <path d="M9.5 11.2 11.4 13l3.1-3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.8" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" />
    </svg>
  );
}
