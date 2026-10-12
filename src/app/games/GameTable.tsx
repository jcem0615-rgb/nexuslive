'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { BeanIcon, Card, DiamondIcon } from '@/components/ui';
import { thousands } from '@/lib/format';

type Outcome = { key: string; label: string; payoutBeans: number; chance: number };
type Game = {
  key: string;
  name: string;
  blurb: string;
  costDiamonds: number;
  pickRange: number | null;
  outcomes: Outcome[];
};

type PlayResult = {
  outcome: { key: string; label: string; payoutBeans: number };
  drawn: number | null;
  balances: { purchasedDiamonds: number; earnedDiamonds?: number };
};

export function GameTable({
  games,
  diamonds: initialDiamonds,
  beans: initialBeans,
}: {
  games: Game[];
  diamonds: number;
  beans: number;
}) {
  const router = useRouter();
  const [diamonds, setDiamonds] = useState(initialDiamonds);
  const [beans, setBeans] = useState(initialBeans);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, PlayResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [openOdds, setOpenOdds] = useState<string | null>(null);

  async function play(game: Game) {
    setBusy(game.key);
    setErrors((current) => ({ ...current, [game.key]: '' }));

    try {
      const result = await api<PlayResult>('/api/games/play', {
        method: 'POST',
        body: {
          game: game.key,
          ...(game.pickRange ? { pick: picks[game.key] ?? 1 } : {}),
        },
      });
      setResults((current) => ({ ...current, [game.key]: result }));
      setDiamonds(result.balances.purchasedDiamonds);
      if (result.balances.earnedDiamonds !== undefined) setBeans(result.balances.earnedDiamonds);
      router.refresh();
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [game.key]: err instanceof ApiError ? err.message : 'Round failed',
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="pill bg-diamond/15 text-diamond">
          <DiamondIcon />
          <span className="tabular-nums">{thousands(diamonds)}</span>
        </span>
        <span className="pill bg-bean/15 text-bean">
          <BeanIcon />
          <span className="tabular-nums">{thousands(beans)}</span>
        </span>
      </div>

      {games.map((game) => {
        const result = results[game.key];
        const error = errors[game.key];
        const affordable = diamonds >= game.costDiamonds;

        return (
          <Card key={game.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white">{game.name}</h2>
                <p className="mt-0.5 text-xs text-slate-400">{game.blurb}</p>
              </div>
              <span className="pill shrink-0 bg-diamond/15 text-diamond">
                <DiamondIcon />
                {game.costDiamonds}
              </span>
            </div>

            {game.pickRange && (
              <div className="mt-4">
                <p className="label">Your number</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: game.pickRange }, (_, i) => i + 1).map((n) => {
                    const chosen = (picks[game.key] ?? 1) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPicks((current) => ({ ...current, [game.key]: n }))}
                        className={`h-9 w-9 rounded-lg text-sm font-bold tabular-nums transition ${
                          chosen
                            ? 'bg-nexus-500 text-white shadow-glow'
                            : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                        aria-pressed={chosen}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {result && (
              <div
                className={`mt-4 rounded-xl px-3.5 py-3 text-sm ${
                  result.outcome.payoutBeans > 0
                    ? 'border border-bean/30 bg-bean/10 text-bean'
                    : 'border border-white/10 bg-white/5 text-slate-400'
                }`}
                role="status"
              >
                <p className="font-bold">{result.outcome.label}</p>
                {result.drawn !== null && (
                  <p className="mt-0.5 text-xs opacity-80">The server drew {result.drawn}.</p>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 text-sm text-live">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => play(game)}
                disabled={!affordable || busy !== null}
                className="btn-primary flex-1"
              >
                {busy === game.key ? 'Rolling…' : affordable ? 'Play' : 'Not enough diamonds'}
              </button>
              <button
                type="button"
                onClick={() => setOpenOdds(openOdds === game.key ? null : game.key)}
                className="btn-ghost shrink-0 text-xs"
                aria-expanded={openOdds === game.key}
              >
                Odds
              </button>
            </div>

            {openOdds === game.key && (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1.5 font-semibold">Outcome</th>
                    <th className="pb-1.5 text-right font-semibold">Beans</th>
                    <th className="pb-1.5 text-right font-semibold">Chance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {game.outcomes.map((outcome) => (
                    <tr key={outcome.key}>
                      <td className="py-1.5 text-slate-300">{outcome.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-bean">
                        {outcome.payoutBeans || '—'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-slate-400">
                        {(outcome.chance * 100).toFixed(outcome.chance < 0.01 ? 2 : 1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}

      <p className="text-center text-xs text-slate-500">
        Outcomes are drawn server-side with a cryptographic random source and stored with the round,
        so any payout can be checked after the fact.
      </p>
    </div>
  );
}
