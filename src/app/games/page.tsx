import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Card, LinkButton, PageHeader } from '@/components/ui';
import { GAME_LIST, ROLL_SPACE } from '@/lib/economy';
import { GameTable } from './GameTable';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mini-games' };

export default async function GamesPage() {
  const user = await getUser();

  const recent = user
    ? await prisma.gameRound.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          game: true,
          outcomeKey: true,
          payoutBeans: true,
          wagerDiamonds: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader
          title="Mini-games"
          subtitle="Diamonds in, beans out. Every roll is drawn on the server."
        />

        {user ? (
          <GameTable
            games={GAME_LIST.map((game) => ({
              key: game.key,
              name: game.name,
              blurb: game.blurb,
              costDiamonds: game.costDiamonds,
              pickRange: game.pickRange ?? null,
              outcomes: game.outcomes.map((outcome) => ({
                key: outcome.key,
                label: outcome.label,
                payoutBeans: outcome.payoutBeans,
                chance: outcome.weight / ROLL_SPACE,
              })),
            }))}
            diamonds={user.purchasedDiamonds}
            beans={user.earnedDiamonds}
          />
        ) : (
          <Card className="text-center">
            <p className="text-sm text-slate-300">Sign in to play.</p>
            <LinkButton href="/login" className="mt-4">
              Sign in
            </LinkButton>
          </Card>
        )}

        {recent.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
              Your last rounds
            </h2>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              {recent.map((round) => (
                <li key={round.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1 truncate text-slate-300">
                    {round.game.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <span className="text-xs text-slate-500">{timeAgo(round.createdAt)}</span>
                  <span
                    className={`w-20 text-right font-bold tabular-nums ${
                      round.payoutBeans > 0 ? 'text-bean' : 'text-slate-600'
                    }`}
                  >
                    {round.payoutBeans > 0 ? `+${round.payoutBeans}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
