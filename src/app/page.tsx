import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { StreamCard } from '@/components/StreamCard';
import { Logo } from '@/components/Logo';
import { Avatar, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { compact } from '@/lib/format';
import { DAILY_BONUS_DIAMONDS, SIGNUP_BONUS_DIAMONDS, hostLevel } from '@/lib/economy';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getUser();

  const [streams, topHosts, clans] = await Promise.all([
    prisma.stream.findMany({
      where: { status: 'LIVE' },
      orderBy: [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
      take: 8,
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
    prisma.user.findMany({
      where: { isLocked: false, totalEarned: { gt: 0 } },
      orderBy: { totalEarned: 'desc' },
      take: 5,
      select: { id: true, username: true, displayName: true, avatarUrl: true, totalEarned: true },
    }),
    prisma.clan.findMany({
      orderBy: { points: 'desc' },
      take: 3,
      select: { id: true, name: true, tag: true, points: true, memberCount: true },
    }),
  ]);

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!user && <Hero />}

        <section className="mb-8">
          <PageHeader
            title="Live now"
            subtitle={streams.length ? `${streams.length} broadcasting` : undefined}
            action={
              streams.length > 0 ? (
                <Link href="/live" className="text-sm font-semibold text-nexus-300 hover:text-nexus-200">
                  See all
                </Link>
              ) : undefined
            }
          />

          {streams.length === 0 ? (
            <EmptyState
              title="Nobody is live yet"
              body="Be the first on Nexus tonight. Start a stream and your viewers can send gifts straight away."
              action={<LinkButton href={user ? '/live' : '/signup'} variant="live">Go live</LinkButton>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {streams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card as="section">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
              Top hosts
            </h2>
            {topHosts.length === 0 ? (
              <p className="text-sm text-slate-500">No beans earned yet.</p>
            ) : (
              <ol className="space-y-3">
                {topHosts.map((host, index) => (
                  <li key={host.id} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold tabular-nums text-slate-500">
                      {index + 1}
                    </span>
                    <Avatar name={host.displayName} src={host.avatarUrl} size={32} />
                    <Link href={`/u/${host.username}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate text-sm font-semibold text-white">{host.displayName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {hostLevel(host.totalEarned).title}
                      </p>
                    </Link>
                    <span className="text-sm font-bold tabular-nums text-bean">
                      {compact(host.totalEarned)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card as="section">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Clans</h2>
            {clans.length === 0 ? (
              <p className="text-sm text-slate-500">
                No clans yet.{' '}
                <Link href="/clans" className="font-semibold text-nexus-300 hover:underline">
                  Found the first one
                </Link>
                .
              </p>
            ) : (
              <ol className="space-y-3">
                {clans.map((clan, index) => (
                  <li key={clan.id} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold tabular-nums text-slate-500">
                      {index + 1}
                    </span>
                    <Link href={`/clans/${clan.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate text-sm font-semibold text-white">
                        <span className="text-nexus-300">[{clan.tag}]</span> {clan.name}
                      </p>
                      <p className="text-xs text-slate-500">{clan.memberCount} members</p>
                    </Link>
                    <span className="text-sm font-bold tabular-nums text-nexus-300">
                      {compact(clan.points)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}

function Hero() {
  return (
    <section className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-nexus-700/40 via-ink-800 to-ink-900 px-6 py-10 text-center sm:px-10 sm:py-14">
      <Logo size={76} pulse className="mx-auto mb-5" />
      <h1 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Go live. Send diamonds.
        <br />
        <span className="text-live">Cash out beans.</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-balance text-sm text-slate-300 sm:text-base">
        Streaming, gifting, mini-games and clans in one app. {SIGNUP_BONUS_DIAMONDS} diamonds the
        moment you join, {DAILY_BONUS_DIAMONDS} more every day you come back.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/signup" className="px-6">
          Create an account
        </LinkButton>
        <LinkButton href="/live" variant="ghost">
          Browse live
        </LinkButton>
      </div>
    </section>
  );
}
