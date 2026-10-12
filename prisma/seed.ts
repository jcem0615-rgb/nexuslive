/**
 * Creates the one and only Master Admin from the environment (rule 4 — no
 * endpoint can grant that role, so this script is the only way it exists).
 *
 *   npm run db:seed
 *
 * Outside production it also lays down a handful of demo accounts, streams
 * and a clan so the app has something to show on first run. Every diamond and
 * bean it hands out goes through adjustWallet, so the seeded ledger is real.
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BCRYPT_COST, SIGNUP_BONUS_DIAMONDS, STREAM_SEAT_COUNT } from '../src/lib/economy';
import { adjustWallet } from '../src/lib/wallet';

const prisma = new PrismaClient();

const PLACEHOLDER = 'change-me-before-seeding';

async function seedOwner() {
  const email = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.MASTER_ADMIN_PASSWORD;
  const username = process.env.MASTER_ADMIN_USERNAME?.trim().toLowerCase() || 'owner';

  if (!email || !password) {
    throw new Error('Set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD before seeding');
  }
  if (process.env.NODE_ENV === 'production' && password === PLACEHOLDER) {
    throw new Error('Refusing to seed the owner with the placeholder password');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const owner = await prisma.user.upsert({
    where: { email },
    update: { role: 'MASTER_ADMIN', passwordHash, isLocked: false, lockedReason: null },
    create: {
      email,
      username,
      passwordHash,
      displayName: 'Nexus Owner',
      role: 'MASTER_ADMIN',
      bio: 'Keeper of the nexus.',
    },
    select: { id: true, email: true, username: true, role: true },
  });

  console.log(`  owner   ${owner.email} (@${owner.username}) -> ${owner.role}`);
  return owner;
}

type DemoSpec = {
  username: string;
  displayName: string;
  bio: string;
  gender: 'FEMALE' | 'MALE' | 'OTHER' | 'UNSPECIFIED';
  topUp: number;
};

const DEMO_USERS: DemoSpec[] = [
  { username: 'aria', displayName: 'Aria', bio: 'Singing every night at 9.', gender: 'FEMALE', topUp: 2_000 },
  { username: 'kenji', displayName: 'Kenji', bio: 'Ranked grind, no talking.', gender: 'MALE', topUp: 5_000 },
  { username: 'mila', displayName: 'Mila', bio: 'Dance covers + chaos.', gender: 'FEMALE', topUp: 1_200 },
  { username: 'dev', displayName: 'Dev', bio: 'Building things live.', gender: 'OTHER', topUp: 800 },
  { username: 'zuri', displayName: 'Zuri', bio: 'Late night talk show.', gender: 'FEMALE', topUp: 15_000 },
];

async function seedDemo(ownerId: string) {
  const passwordHash = await bcrypt.hash('demo1234', BCRYPT_COST);
  const created: { id: string; username: string }[] = [];

  for (const spec of DEMO_USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: spec.username },
      select: { id: true, username: true },
    });
    if (existing) {
      created.push(existing);
      continue;
    }

    const user = await prisma.$transaction(async (tx) => {
      const made = await tx.user.create({
        data: {
          email: `${spec.username}@demo.nexuslive.app`,
          username: spec.username,
          passwordHash,
          displayName: spec.displayName,
          bio: spec.bio,
          gender: spec.gender,
          role: 'USER',
        },
        select: { id: true, username: true },
      });

      await adjustWallet(tx, {
        userId: made.id,
        wallet: 'PURCHASED',
        amount: SIGNUP_BONUS_DIAMONDS,
        kind: 'SIGNUP_BONUS',
        memo: 'Welcome to Nexus Live',
      });
      await adjustWallet(tx, {
        userId: made.id,
        wallet: 'PURCHASED',
        amount: spec.topUp,
        kind: 'PURCHASE',
        memo: 'Seeded balance',
      });

      return made;
    });

    created.push(user);
  }
  console.log(`  demo    ${created.length} accounts (password: demo1234)`);

  // Two of them go live.
  const liveSpecs = [
    { username: 'aria', title: 'Acoustic set — requests open', category: 'Music' },
    { username: 'kenji', title: 'Ranked climb to Diamond', category: 'Gaming' },
  ];
  for (const spec of liveSpecs) {
    const host = created.find((u) => u.username === spec.username);
    if (!host) continue;
    const already = await prisma.stream.findFirst({
      where: { hostId: host.id, status: 'LIVE' },
      select: { id: true },
    });
    if (already) continue;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: host.id }, data: { role: 'HOST' } });
      await tx.stream.create({
        data: {
          hostId: host.id,
          title: spec.title,
          category: spec.category,
          roomName: `nexus_${randomUUID()}`,
          viewerCount: 40 + Math.floor(Math.random() * 400),
          peakViewers: 600,
          seats: {
            create: Array.from({ length: STREAM_SEAT_COUNT }, (_, i) => ({ position: i + 1 })),
          },
        },
      });
    });
  }
  console.log(`  streams ${liveSpecs.length} live`);

  // A clan, led by the biggest spender.
  const leader = created.find((u) => u.username === 'zuri');
  if (leader) {
    const existing = await prisma.clan.findUnique({ where: { tag: 'NOVA' }, select: { id: true } });
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const clan = await tx.clan.create({
          data: {
            name: 'Nova Syndicate',
            tag: 'NOVA',
            description: 'Loud, generous, slightly unhinged.',
            ownerId: leader.id,
            memberCount: 1,
          },
        });
        await tx.clanMember.create({
          data: { clanId: clan.id, userId: leader.id, role: 'LEADER' },
        });
      });
      console.log('  clan    NOVA');
    }
  }

  await backfillSeats();

  await prisma.platformSetting.upsert({
    where: { key: 'maintenanceMode' },
    create: { key: 'maintenanceMode', value: false },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: 'signupsOpen' },
    create: { key: 'signupsOpen', value: true },
    update: {},
  });

  void ownerId;
}

/**
 * Give seats to any stream that has none.
 *
 * Streams created before multi-guest existed have no seat rows, and the seed
 * runs on every deploy — so this is what upgrades them in place rather than
 * leaving a live stream with no stage.
 */
async function backfillSeats() {
  const streams = await prisma.stream.findMany({
    where: { seats: { none: {} } },
    select: { id: true },
  });
  if (streams.length === 0) return;

  for (const stream of streams) {
    await prisma.streamSeat.createMany({
      data: Array.from({ length: STREAM_SEAT_COUNT }, (_, i) => ({
        streamId: stream.id,
        position: i + 1,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`  seats   backfilled ${streams.length} stream(s)`);
}

async function main() {
  console.log('seeding nexus live');
  const owner = await seedOwner();

  // Demo data is for development. A hosted test deployment runs with
  // NODE_ENV=production but still needs funded accounts to exercise gifting,
  // games and cash-out — because /api/wallet/purchase refuses to self-settle
  // in production, there is no other way to get diamonds there. SEED_DEMO_DATA
  // is the explicit opt-in for exactly that case; never set it on a real one.
  const wantsDemo = process.env.SEED_DEMO_DATA === 'true';

  if (process.env.NODE_ENV === 'production' && !wantsDemo) {
    console.log('  demo    skipped in production');
    // Still upgrade any existing streams — this is the deploy path.
    await backfillSeats();
  } else {
    if (wantsDemo) console.log('  demo    SEED_DEMO_DATA=true — seeding demo accounts');
    await seedDemo(owner.id);
  }

  console.log('done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
