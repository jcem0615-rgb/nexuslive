import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size={60} className="mb-6 opacity-60" />
      <h1 className="text-xl font-extrabold text-white">Nothing here</h1>
      <p className="mt-2 text-sm text-slate-400">
        That page does not exist, or it is not yours to see.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to the nexus
      </Link>
    </main>
  );
}
