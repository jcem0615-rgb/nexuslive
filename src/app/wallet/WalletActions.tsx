'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Card, DiamondIcon } from '@/components/ui';
import {
  CASHOUT_FEE_RATE,
  DAILY_BONUS_DIAMONDS,
  MIN_CASHOUT_BEANS,
  formatCents,
  quoteCashout,
} from '@/lib/economy';
import { thousands } from '@/lib/format';

type Pack = {
  code: string;
  diamonds: number;
  bonus: number;
  priceCents: number;
  total: number;
  popular?: boolean;
};

export function WalletActions({
  packs,
  beans,
  canClaimDaily,
  openCashout,
}: {
  packs: Pack[];
  beans: number;
  canClaimDaily: boolean;
  openCashout: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function run(key: string, work: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ tone: 'ok', text: await work() });
      router.refresh();
    } catch (err) {
      setMessage({
        tone: 'bad',
        text: err instanceof ApiError ? err.message : 'That did not go through',
      });
    } finally {
      setBusy(null);
    }
  }

  const claim = () =>
    run('daily', async () => {
      await api('/api/wallet/daily-bonus', { method: 'POST' });
      return `+${DAILY_BONUS_DIAMONDS} diamonds. See you tomorrow.`;
    });

  const buy = (pack: Pack) =>
    run(pack.code, async () => {
      const result = await api<{ credited?: number; message?: string }>('/api/wallet/purchase', {
        method: 'POST',
        body: { packCode: pack.code },
      });
      return result.credited
        ? `+${thousands(result.credited)} diamonds added.`
        : (result.message ?? 'Order recorded.');
    });

  async function requestCashout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run('cashout', async () => {
      await api('/api/wallet/cashout', {
        method: 'POST',
        body: {
          beans: Number(form.get('beans')),
          method: form.get('method'),
          payoutHandle: form.get('payoutHandle'),
        },
      });
      return 'Cash-out filed. Your beans are held until it is reviewed.';
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {message && (
        <p
          role="status"
          className={`rounded-xl px-3.5 py-2.5 text-sm ${
            message.tone === 'ok'
              ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border border-live/30 bg-live/10 text-live'
          }`}
        >
          {message.text}
        </p>
      )}

      <Card className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Daily check-in</p>
          <p className="text-xs text-slate-400">
            {canClaimDaily
              ? `${DAILY_BONUS_DIAMONDS} diamonds, once a day.`
              : 'Claimed today — resets at midnight UTC.'}
          </p>
        </div>
        <button
          type="button"
          onClick={claim}
          disabled={!canClaimDaily || busy === 'daily'}
          className="btn-primary shrink-0"
        >
          {busy === 'daily' ? '…' : canClaimDaily ? 'Claim' : 'Claimed'}
        </button>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
          Top up diamonds
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packs.map((pack) => (
            <button
              key={pack.code}
              type="button"
              onClick={() => buy(pack)}
              disabled={busy === pack.code}
              className={`card relative p-4 text-left transition hover:border-nexus-400/50 disabled:opacity-60 ${
                pack.popular ? 'border-nexus-400/50 shadow-glow' : ''
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-nexus-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  Popular
                </span>
              )}
              <span className="flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-diamond">
                <DiamondIcon className="h-4 w-4" />
                {thousands(pack.total)}
              </span>
              {pack.bonus > 0 && (
                <span className="mt-0.5 block text-[11px] font-semibold text-emerald-400">
                  +{thousands(pack.bonus)} bonus
                </span>
              )}
              <span className="mt-1.5 block text-sm font-bold text-white">
                {busy === pack.code ? '…' : formatCents(pack.priceCents)}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Card checkout is not connected yet. Outside production these settle immediately so the
          economy can be exercised end to end.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
          Cash out beans
        </h2>
        <Card>
          {openCashout ? (
            <p className="text-sm text-slate-400">
              You already have a cash-out in review. One at a time — we will email you when it moves.
            </p>
          ) : beans < MIN_CASHOUT_BEANS ? (
            <p className="text-sm text-slate-400">
              You need {thousands(MIN_CASHOUT_BEANS)} beans to withdraw. You have{' '}
              {thousands(beans)}.
            </p>
          ) : (
            <form onSubmit={requestCashout}>
              <label className="label" htmlFor="beans">
                Beans to withdraw
              </label>
              <input
                id="beans"
                name="beans"
                type="number"
                min={MIN_CASHOUT_BEANS}
                max={beans}
                defaultValue={beans}
                required
                className="input tabular-nums"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {thousands(beans)} beans ={' '}
                <span className="font-semibold text-bean">
                  {formatCents(quoteCashout(beans).netCents)}
                </span>{' '}
                after the {Math.round(CASHOUT_FEE_RATE * 100)}% fee.
              </p>

              <label className="label mt-4" htmlFor="method">
                Method
              </label>
              <select id="method" name="method" className="input" defaultValue="PAYPAL">
                <option value="PAYPAL">PayPal</option>
                <option value="BANK">Bank transfer</option>
                <option value="GCASH">GCash</option>
                <option value="USDT">USDT</option>
              </select>

              <label className="label mt-4" htmlFor="payoutHandle">
                Where to send it
              </label>
              <input
                id="payoutHandle"
                name="payoutHandle"
                required
                className="input"
                placeholder="you@example.com or an account number"
              />

              <button type="submit" disabled={busy === 'cashout'} className="btn-primary mt-5 w-full">
                {busy === 'cashout' ? 'Filing…' : 'Request cash-out'}
              </button>
            </form>
          )}
        </Card>
      </section>
    </div>
  );
}
