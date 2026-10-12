import Link from 'next/link';
import { Logo } from './Logo';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-7 flex flex-col items-center gap-3" aria-label="Nexus Live home">
        <Logo size={62} pulse />
        <span className="text-xl font-extrabold tracking-tight text-white">
          NEXUS<span className="text-live">LIVE</span>
        </span>
      </Link>

      <div className="card p-6">
        <h1 className="text-lg font-extrabold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-400">{footer}</p>
    </main>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-live">{message}</p>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-sm text-live"
    >
      {message}
    </p>
  );
}
