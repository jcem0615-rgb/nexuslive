import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { CLAN_CREATE_COST, CLAN_MAX_MEMBERS } from '@/lib/economy';
import { compact, thousands } from '@/lib/format';
import { CreateClan } from './CreateClan';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clans' };

export default async function ClansPage() {
  const user = await getUser();

  const [clans, membership] = await Promise.all([
    prisma.clan.findMany({
      orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
      take: 50,
      select: {
        id: true,
        name: true,
        tag: true,
        description: true,
        points: true,
        memberCount: true,
        isOpen: true,
      },
    }),
    user
      ? prisma.clanMember.findUnique({
          where: { userId: user.id },
          select: { role: true, clan: { select: { id: true, name: true, tag: true } } },
        })
      : null,
  ]);

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader
          title="Clans"
          subtitle={`Up to ${CLAN_MAX_MEMBERS} members. Every diamond a member gifts becomes a clan point.`}
          action={
            user && !membership ? (
              <CreateClan cost={CLAN_CREATE_COST} diamonds={user.purchasedDiamonds} />
            ) : undefined
          }
        />

        {membership && (
          <Card className="mb-5 flex items-center gap-3 border-nexus-400/40">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your clan
              </p>
              <Link
                href={`/clans/${membership.clan.id}`}
                className="text-sm font-bold text-white hover:underline"
              >
                <span className="text-nexus-300">[{membership.clan.tag}]</span>{' '}
                {membership.clan.name}
              </Link>
            </div>
            <span className="pill bg-white/5 text-slate-300">{membership.role}</span>
          </Card>
        )}

        {clans.length === 0 ? (
          <EmptyState
            title="No clans yet"
            body={`Found the first one for ${thousands(CLAN_CREATE_COST)} diamonds and start stacking points.`}
          />
        ) : (
          <ol className="space-y-2">
            {clans.map((clan, index) => (
              <li key={clan.id}>
                <Link
                  href={`/clans/${clan.id}`}
                  className="card flex items-center gap-3 px-4 py-3 transition hover:border-nexus-400/50"
                >
                  <span className="w-6 text-center text-sm font-bold tabular-nums text-slate-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      <span className="text-nexus-300">[{clan.tag}]</span> {clan.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {clan.memberCount}/{CLAN_MAX_MEMBERS} members
                      {clan.description ? ` · ${clan.description}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-nexus-300">
                    {compact(clan.points)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}
