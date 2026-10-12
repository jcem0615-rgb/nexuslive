import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { StreamCard } from '@/components/StreamCard';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { GoLive } from './GoLive';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live now' };

export default async function LivePage() {
  const user = await getUser();

  const [streams, mine] = await Promise.all([
    prisma.stream.findMany({
      where: { status: 'LIVE' },
      orderBy: [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
      take: 48,
      select: {
        id: true,
        title: true,
        category: true,
        thumbnailUrl: true,
        viewerCount: true,
        beansEarned: true,
        startedAt: true,
        host: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    }),
    user
      ? prisma.stream.findFirst({
          where: { hostId: user.id, status: 'LIVE' },
          select: { id: true, title: true },
        })
      : null,
  ]);

  const categories = [...new Set(streams.map((s) => s.category))];

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader
          title="Live now"
          subtitle={`${streams.length} broadcasting`}
          action={user ? <GoLive liveStream={mine} /> : <LinkButton href="/signup">Join to stream</LinkButton>}
        />

        {categories.length > 1 && (
          <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
            {categories.map((category) => (
              <span key={category} className="pill shrink-0 bg-white/5 text-slate-300">
                {category}
              </span>
            ))}
          </div>
        )}

        {streams.length === 0 ? (
          <EmptyState
            title="The nexus is quiet"
            body="No one is streaming right now. Start one and anybody who joins can gift you straight away."
            action={user ? undefined : <LinkButton href="/signup">Create an account</LinkButton>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
