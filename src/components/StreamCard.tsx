import Link from 'next/link';
import { Avatar, LiveBadge } from './ui';
import { compact, duration } from '@/lib/format';

export type StreamCardData = {
  id: string;
  title: string;
  category: string;
  thumbnailUrl: string | null;
  viewerCount: number;
  beansEarned: number;
  startedAt: Date | string;
  host: { username: string; displayName: string; avatarUrl: string | null };
};

export function StreamCard({ stream }: { stream: StreamCardData }) {
  return (
    <Link
      href={`/live/${stream.id}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-nexus-400/50 hover:shadow-glow"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-nexus-700/50 via-ink-700 to-ink-800">
        {stream.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stream.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Avatar name={stream.host.displayName} src={stream.host.avatarUrl} size={64} />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <LiveBadge viewers={stream.viewerCount} />
        </div>
        <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {duration(stream.startedAt)}
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-3">
        <Avatar name={stream.host.displayName} src={stream.host.avatarUrl} size={34} ring />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{stream.title}</p>
          <p className="truncate text-xs text-slate-400">
            {stream.host.displayName} · {stream.category}
          </p>
          {stream.beansEarned > 0 && (
            <p className="mt-0.5 text-[11px] font-semibold text-bean">
              {compact(stream.beansEarned)} beans this stream
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
