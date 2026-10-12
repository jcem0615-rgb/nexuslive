import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isMasterAdmin } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Card, PageHeader, Stat } from '@/components/ui';
import { WalletActions } from './WalletActions';
import { LedgerList } from './LedgerList';
import {
  BEANS_PER_USD,
  CASHOUT_FEE_RATE,
  DIAMOND_PACKS,
  MIN_CASHOUT_BEANS,
  formatCents,
  hostLevel,
  packTotalDiamonds,
  quoteCashout,
  senderLevel,
} from '@/lib/economy';
import { compact, thousands } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wallet' };

export default async function WalletPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=%2Fwallet');

  const [entries, cashouts] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        wallet: true,
        kind: true,
        amount: true,
        balanceAfter: true,
        memo: true,
        createdAt: true,
      },
    }),
    prisma.cashoutRequest.findMany({
      where: { userId: user.id },
      orderBy: { requestedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        beans: true,
        netCents: true,
        method: true,
        status: true,
        requestedAt: true,
      },
    }),
  ]);

  const sender = senderLevel(user.totalSpent);
  const host = hostLevel(user.totalEarned);
  const quote = quoteCashout(user.earnedDiamonds);

  return (
    <>
      <TopBar user={user} isOwner={isMasterAdmin(user)} />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader title="Wallet" subtitle="Two balances. They do not mix." />

        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Diamonds"
            value={thousands(user.purchasedDiamonds)}
            hint="Spend only — gifts and games"
            tone="diamond"
          />
          <Stat
            label="Beans"
            value={thousands(user.earnedDiamonds)}
            hint={`Cashable · worth ${formatCents(quote.netCents)} after fees`}
            tone="bean"
          />
        </div>

        <Card className="mt-3">
          <p className="text-xs leading-relaxed text-slate-400">
            <strong className="text-diamond">Diamonds</strong> are what you buy and spend — on
            gifts and game rounds. They can never be withdrawn.{' '}
            <strong className="text-bean">Beans</strong> are what you earn when someone gifts you
            or you win a round, and they are the only balance that converts to money:{' '}
            {BEANS_PER_USD} beans = $1.00, less a {Math.round(CASHOUT_FEE_RATE * 100)}% fee, from{' '}
            {MIN_CASHOUT_BEANS} beans up.
          </p>
        </Card>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <LevelCard
            title="Sender level"
            level={sender.level}
            name={sender.title}
            current={sender.current}
            next={sender.nextThreshold}
            progress={sender.progress}
            unit="diamonds spent"
            tone="diamond"
          />
          <LevelCard
            title="Host level"
            level={host.level}
            name={host.title}
            current={host.current}
            next={host.nextThreshold}
            progress={host.progress}
            unit="beans earned"
            tone="bean"
          />
        </div>

        <WalletActions
          packs={DIAMOND_PACKS.map((pack) => ({ ...pack, total: packTotalDiamonds(pack) }))}
          beans={user.earnedDiamonds}
          canClaimDaily={!isSameUtcDay(user.lastDailyBonusAt)}
          openCashout={cashouts.some((c) => c.status === 'PENDING' || c.status === 'APPROVED')}
        />

        {cashouts.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
              Cash-outs
            </h2>
            <ul className="space-y-2">
              {cashouts.map((request) => (
                <li key={request.id} className="card flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {compact(request.beans)} beans · {formatCents(request.netCents)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {request.method} · {request.requestedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <StatusPill status={request.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
            Every movement
          </h2>
          <LedgerList entries={entries} />
        </section>
      </main>
    </>
  );
}

function isSameUtcDay(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

function LevelCard({
  title,
  level,
  name,
  current,
  next,
  progress,
  unit,
  tone,
}: {
  title: string;
  level: number;
  name: string;
  current: number;
  next: number | null;
  progress: number;
  unit: string;
  tone: 'diamond' | 'bean';
}) {
  const bar = tone === 'diamond' ? 'bg-diamond' : 'bg-bean';
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</span>
        <span className="text-xs font-bold text-slate-300">Lv {level}</span>
      </div>
      <p className="mt-1 text-lg font-extrabold text-white">{name}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {next === null
          ? `${compact(current)} ${unit} — top band`
          : `${compact(current)} / ${compact(next)} ${unit}`}
      </p>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    PENDING: 'bg-amber-400/15 text-amber-300',
    APPROVED: 'bg-sky-400/15 text-sky-300',
    PAID: 'bg-emerald-400/15 text-emerald-300',
    REJECTED: 'bg-live/15 text-live',
  };
  return <span className={`pill ${tones[status] ?? 'bg-white/10 text-slate-300'}`}>{status}</span>;
}
