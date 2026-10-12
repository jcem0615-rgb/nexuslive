'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/cashouts', label: 'Cash-outs' },
  { href: '/admin/ledger', label: 'Ledger' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/audit', label: 'Audit' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Portal">
      {LINKS.map(({ href, label }) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active ? 'bg-nexus-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
