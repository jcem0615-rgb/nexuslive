import { Logo } from '@/components/Logo';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size={64} className="mb-6 opacity-70" />
      <h1 className="text-xl font-extrabold text-white">You are offline</h1>
      <p className="mt-2 text-sm text-slate-400">
        Nexus needs a connection for streams, balances and gifting — none of that is ever served
        from a cache. Reconnect and pull down to refresh.
      </p>
    </main>
  );
}
