import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Avatar, LiveBadge, Stat } from '@/components/ui';
import { hostLevel, senderLevel } from '@/lib/economy';
import { compact, timeAgo } from '@/lib/format';
import { ProfileActions } from './ProfileActions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { displayName: true },
  });
  return { title: user ? user.displayName : 'Profile' };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getUser();

  const profile = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      role: true,
      totalSpent: true,
      totalEarned: true,
      isLocked: true,
      createdAt: true,
      clanMembership: {
        select: { role: true, clan: { select: { id: true, name: true, tag: true } } },
      },
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!profile || profile.isLocked) notFound();

  const isSelf = viewer?.id === profile.id;

  const [liveStream, isFollowing] = await Promise.all([
    prisma.stream.findFirst({
      where: { hostId: profile.id, status: 'LIVE' },
      select: { id: true, title: true, viewerCount: true },
    }),
    viewer && !isSelf
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: { followerId: viewer.id, followingId: profile.id },
          },
          select: { id: true },
        })
      : null,
  ]);

  const host = hostLevel(profile.totalEarned);
  const sender = senderLevel(profile.totalSpent);

  return (
    <>
      <TopBar user={viewer} isOwner={isMasterAdmin(viewer)} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-start gap-4">
          <Avatar
            name={profile.displayName}
            src={profile.avatarUrl}
            size={76}
            ring={Boolean(liveStream)}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-white">{profile.displayName}</h1>
            <p className="text-sm text-slate-400">@{profile.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="pill bg-bean/15 text-bean">{host.title}</span>
              <span className="pill bg-diamond/15 text-diamond">{sender.title}</span>
              {profile.clanMembership && (
                <Link
                  href={`/clans/${profile.clanMembership.clan.id}`}
                  className="pill bg-nexus-500/20 text-nexus-200 hover:bg-nexus-500/30"
                >
                  [{profile.clanMembership.clan.tag}]
                </Link>
              )}
            </div>
          </div>
          <ProfileActions
            username={profile.username}
            isSelf={isSelf}
            signedIn={Boolean(viewer)}
            following={Boolean(isFollowing)}
          />
        </div>

        {profile.bio && <p className="mt-4 text-sm text-slate-300">{profile.bio}</p>}

        {liveStream && (
          <Link
            href={`/live/${liveStream.id}`}
            className="card mt-5 flex items-center gap-3 px-4 py-3 transition hover:border-live/50"
          >
            <LiveBadge viewers={liveStream.viewerCount} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
              {liveStream.title}
            </span>
            <span className="shrink-0 text-xs font-semibold text-live">Watch</span>
          </Link>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Beans earned" value={compact(profile.totalEarned)} tone="bean" />
          <Stat label="Diamonds sent" value={compact(profile.totalSpent)} tone="diamond" />
          <Stat label="Followers" value={compact(profile._count.followers)} />
          <Stat label="Following" value={compact(profile._count.following)} />
        </div>

        <p className="mt-5 text-center text-xs text-slate-600">
          On Nexus since {timeAgo(profile.createdAt)}
        </p>
      </main>
    </>
  );
}
