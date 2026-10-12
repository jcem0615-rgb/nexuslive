import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GIFTS, beansForGift, hostLevel } from '@/lib/economy';
import { StreamRoom } from './StreamRoom';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = await prisma.stream.findUnique({
    where: { id },
    select: { title: true, host: { select: { displayName: true } } },
  });
  return { title: stream ? `${stream.title} · ${stream.host.displayName}` : 'Stream' };
}

export default async function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();

  const stream = await prisma.stream.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      viewerCount: true,
      beansEarned: true,
      startedAt: true,
      host: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, totalEarned: true },
      },
    },
  });
  if (!stream) notFound();

  const messages = await prisma.chatMessage.findMany({
    where: { streamId: id },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true,
      body: true,
      isSystem: true,
      createdAt: true,
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  if (stream.status === 'ENDED') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-extrabold text-white">This stream has ended</h1>
        <p className="mt-2 text-sm text-slate-400">
          {stream.host.displayName} earned {stream.beansEarned} beans here.
        </p>
        <Link href="/live" className="btn-primary mt-6">
          Find another
        </Link>
      </main>
    );
  }

  return (
    <StreamRoom
      stream={{
        id: stream.id,
        title: stream.title,
        category: stream.category,
        viewerCount: stream.viewerCount,
        beansEarned: stream.beansEarned,
        startedAt: stream.startedAt.toISOString(),
        host: {
          id: stream.host.id,
          username: stream.host.username,
          displayName: stream.host.displayName,
          avatarUrl: stream.host.avatarUrl,
          levelTitle: hostLevel(stream.host.totalEarned).title,
        },
      }}
      initialMessages={messages.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        isSystem: m.isSystem,
        createdAt: m.createdAt.toISOString(),
        user: m.user,
      }))}
      gifts={GIFTS.map((gift) => ({
        code: gift.code,
        name: gift.name,
        glyph: gift.glyph,
        diamonds: gift.diamonds,
        tier: gift.tier,
        beans: beansForGift(gift.diamonds),
      }))}
      viewer={
        user
          ? {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              diamonds: user.purchasedDiamonds,
              isHost: user.id === stream.host.id,
            }
          : null
      }
    />
  );
}
