import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Avatar, Card, PageHeader, Stat } from '@/components/ui';
import { CLAN_MAX_MEMBERS } from '@/lib/economy';
import { compact, timeAgo } from '@/lib/format';
import { ClanMembership } from './ClanMembership';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clan = await prisma.clan.findUnique({ where: { id }, select: { name: true, tag: true } });
  return { title: clan ? `[${clan.tag}] ${clan.name}` : 'Clan' };
}

export default async function ClanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();

  const clan = await prisma.clan.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      points: true,
      memberCount: true,
      isOpen: true,
      createdAt: true,
      owner: { select: { username: true, displayName: true } },
      members: {
        orderBy: [{ points: 'desc' }],
        select: {
          id: true,
          role: true,
          points: true,
          joinedAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!clan) notFound();

  const membership = user ? clan.members.find((m) => m.user.id === user.id) : undefined;
  const otherClan = user && !membership
    ? await prisma.clanMember.findUnique({ where: { userId: user.id }, select: { clanId: true } })
    : null;

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader
          title={clan.name}
          subtitle={clan.description ?? `Founded ${timeAgo(clan.createdAt)} by ${clan.owner.displayName}`}
          action={
            user ? (
              <ClanMembership
                clanId={clan.id}
                isMember={Boolean(membership)}
                isLeader={membership?.role === 'LEADER'}
                inAnotherClan={Boolean(otherClan)}
                isFull={clan.memberCount >= CLAN_MAX_MEMBERS}
                isOpen={clan.isOpen}
              />
            ) : undefined
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Clan points" value={compact(clan.points)} hint="One per diamond gifted" />
          <Stat
            label="Members"
            value={`${clan.memberCount}/${CLAN_MAX_MEMBERS}`}
            hint={clan.isOpen ? 'Open to join' : 'Invite only'}
          />
        </div>

        <Card className="mt-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Roster</h2>
          <ol className="space-y-3">
            {clan.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <Avatar name={member.user.displayName} src={member.user.avatarUrl} size={34} />
                <Link href={`/u/${member.user.username}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-semibold text-white">
                    {member.user.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {member.role === 'MEMBER' ? `joined ${timeAgo(member.joinedAt)}` : member.role}
                  </p>
                </Link>
                <span className="text-sm font-bold tabular-nums text-nexus-300">
                  {compact(member.points)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </main>
    </>
  );
}
