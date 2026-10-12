import Link from 'next/link';
import { compact, initials } from '@/lib/format';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return <Tag className={`card p-4 ${className}`}>{children}</Tag>;
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'diamond' | 'bean' | 'live';
}) {
  const tones = {
    default: 'text-white',
    diamond: 'text-diamond',
    bean: 'text-bean',
    live: 'text-live',
  } as const;

  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-extrabold tabular-nums ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="max-w-sm text-sm text-slate-400">{body}</p>
      {action}
    </div>
  );
}

export function LiveBadge({ viewers }: { viewers?: number }) {
  return (
    <span className="pill bg-live text-white">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-pulse-ring" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      LIVE
      {viewers !== undefined && <span className="tabular-nums opacity-90">{compact(viewers)}</span>}
    </span>
  );
}

export function DiamondPill({ amount }: { amount: number }) {
  return (
    <span className="pill bg-diamond/15 text-diamond" title="Purchased diamonds — spend only">
      <DiamondIcon />
      <span className="tabular-nums">{compact(amount)}</span>
    </span>
  );
}

export function BeanPill({ amount }: { amount: number }) {
  return (
    <span className="pill bg-bean/15 text-bean" title="Beans — your cashable balance">
      <BeanIcon />
      <span className="tabular-nums">{compact(amount)}</span>
    </span>
  );
}

export function DiamondIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 3h12l4 6-10 12L2 9z" opacity=".35" />
      <path d="M6 3h12l4 6H2z" />
    </svg>
  );
}

export function BeanIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.8 3.4c3 1.9 3.9 6 2 9.3-1.8 3.2-5.3 5.5-9 7.2-3 1.3-6.3-.6-7.2-3.7-.9-3.2.8-6.6 3.6-9 2.9-2.5 7.3-5.3 10.6-3.8z" />
    </svg>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  ring,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-nexus-400 to-nexus-700 text-xs font-bold text-white ${
        ring ? 'ring-2 ring-live ring-offset-2 ring-offset-ink-900' : ''
      }`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {src ? (
        // Avatars are arbitrary remote URLs, so plain img rather than
        // next/image — no remotePatterns to maintain.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'live';
  className?: string;
}) {
  const classes = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    live: 'btn-live',
  } as const;
  return (
    <Link href={href} className={`${classes[variant]} ${className}`}>
      {children}
    </Link>
  );
}
