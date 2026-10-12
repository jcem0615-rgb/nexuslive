import { ok, route } from '@/lib/http';
import { GAME_LIST, ROLL_SPACE, expectedPayout } from '@/lib/economy';

export const runtime = 'nodejs';

/** The odds are public — every weight and payout is published here. */
export const GET = route(async () =>
  ok({
    rollSpace: ROLL_SPACE,
    games: GAME_LIST.map((game) => ({
      key: game.key,
      name: game.name,
      blurb: game.blurb,
      costDiamonds: game.costDiamonds,
      pickRange: game.pickRange ?? null,
      expectedBeans: Number(expectedPayout(game).toFixed(2)),
      outcomes: game.outcomes.map((outcome) => ({
        key: outcome.key,
        label: outcome.label,
        payoutBeans: outcome.payoutBeans,
        chance: outcome.weight / ROLL_SPACE,
      })),
    })),
  }),
);
