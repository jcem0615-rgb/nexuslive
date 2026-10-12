import { describe, expect, it } from 'vitest';
import {
  BEANS_PER_USD,
  CASHOUT_FEE_RATE,
  CLAN_MAX_MEMBERS,
  DIAMOND_PACKS,
  GAME_LIST,
  GIFTS,
  GIFT_BEAN_RATE,
  HOST_LEVELS,
  LUCKY_NUMBER,
  LUCKY_SPIN,
  MIN_CASHOUT_BEANS,
  ROLL_SPACE,
  SENDER_LEVELS,
  SIGNUP_BONUS_DIAMONDS,
  TREASURE_CHEST,
  beansForGift,
  clanPointsForGift,
  expectedPayout,
  findGame,
  findGift,
  findPack,
  hostLevel,
  packTotalDiamonds,
  quoteCashout,
  resolveRound,
  senderLevel,
} from './economy';

describe('diamond packs', () => {
  it('are uniquely coded and priced in whole cents', () => {
    const codes = DIAMOND_PACKS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const pack of DIAMOND_PACKS) {
      expect(Number.isInteger(pack.priceCents)).toBe(true);
      expect(pack.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(pack.diamonds)).toBe(true);
      expect(Number.isInteger(pack.bonus)).toBe(true);
      expect(pack.bonus).toBeGreaterThanOrEqual(0);
    }
  });

  it('get better value as they get bigger', () => {
    const rates = DIAMOND_PACKS.map((p) => packTotalDiamonds(p) / p.priceCents);
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]!).toBeGreaterThan(rates[i - 1]!);
    }
  });

  it('look up by code', () => {
    expect(findPack('standard')?.diamonds).toBe(700);
    expect(packTotalDiamonds(findPack('standard')!)).toBe(735);
    expect(findPack('nope')).toBeUndefined();
  });
});

describe('gifts', () => {
  it('are uniquely coded with positive integer costs', () => {
    const codes = GIFTS.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const gift of GIFTS) {
      expect(Number.isInteger(gift.diamonds)).toBe(true);
      expect(gift.diamonds).toBeGreaterThan(0);
    }
  });

  it('are listed cheapest first', () => {
    for (let i = 1; i < GIFTS.length; i += 1) {
      expect(GIFTS[i]!.diamonds).toBeGreaterThan(GIFTS[i - 1]!.diamonds);
    }
  });

  it('never earn the receiver zero beans, even the cheapest one', () => {
    for (const gift of GIFTS) {
      expect(beansForGift(gift.diamonds)).toBeGreaterThanOrEqual(1);
    }
  });

  it('pays the receiver GIFT_BEAN_RATE of the cost, rounded down', () => {
    expect(GIFT_BEAN_RATE).toBe(0.6);
    expect(beansForGift(5)).toBe(3);
    expect(beansForGift(99)).toBe(59);
    expect(beansForGift(999)).toBe(599);
    expect(beansForGift(0)).toBe(0);
  });

  it('never pays out more beans than the gift cost in diamonds', () => {
    for (const gift of GIFTS) {
      for (const quantity of [1, 7, 99]) {
        const cost = gift.diamonds * quantity;
        expect(beansForGift(cost)).toBeLessThan(cost);
      }
    }
  });

  it('awards one clan point per diamond gifted', () => {
    expect(clanPointsForGift(999)).toBe(999);
    expect(clanPointsForGift(5 * 10)).toBe(50);
  });

  it('looks up by code', () => {
    expect(findGift('castle')?.diamonds).toBe(9_999);
    expect(findGift('unicorn')).toBeUndefined();
  });
});

describe('cash-out quotes', () => {
  it('converts beans at the published rate', () => {
    expect(BEANS_PER_USD).toBe(210);
    expect(quoteCashout(210).grossCents).toBe(100);
    expect(quoteCashout(21_000).grossCents).toBe(10_000);
  });

  it('takes the fee off the gross and rounds it up', () => {
    expect(CASHOUT_FEE_RATE).toBe(0.1);
    const quote = quoteCashout(21_000);
    expect(quote.feeCents).toBe(1_000);
    expect(quote.netCents).toBe(9_000);

    const small = quoteCashout(MIN_CASHOUT_BEANS);
    expect(small.grossCents).toBe(47);
    expect(small.feeCents).toBe(5);
    expect(small.netCents).toBe(42);
  });

  it('keeps every amount a whole number of cents that adds up', () => {
    for (const beans of [100, 101, 209, 210, 211, 1_000, 4_321, 999_999]) {
      const q = quoteCashout(beans);
      expect(Number.isInteger(q.grossCents)).toBe(true);
      expect(Number.isInteger(q.feeCents)).toBe(true);
      expect(Number.isInteger(q.netCents)).toBe(true);
      expect(q.feeCents + q.netCents).toBe(q.grossCents);
      expect(q.netCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('never pays out more than the beans are worth', () => {
    for (const beans of [100, 500, 12_345]) {
      const q = quoteCashout(beans);
      expect(q.grossCents).toBeLessThanOrEqual((beans * 100) / BEANS_PER_USD);
    }
  });
});

describe('game tables', () => {
  it('all weight tables add up to the roll space', () => {
    for (const game of GAME_LIST) {
      const total = game.outcomes.reduce((sum, o) => sum + o.weight, 0);
      expect(total).toBe(ROLL_SPACE);
    }
  });

  it('are uniquely keyed with a positive cost', () => {
    const keys = GAME_LIST.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const game of GAME_LIST) {
      expect(game.costDiamonds).toBeGreaterThan(0);
      expect(Number.isInteger(game.costDiamonds)).toBe(true);
      const outcomeKeys = game.outcomes.map((o) => o.key);
      expect(new Set(outcomeKeys).size).toBe(outcomeKeys.length);
    }
  });

  it('keeps the house ahead on every game', () => {
    for (const game of GAME_LIST) {
      expect(expectedPayout(game)).toBeLessThan(game.costDiamonds);
    }
  });

  it('holds the documented house edge', () => {
    // Beans paid per round, against the diamond cost.
    expect(expectedPayout(LUCKY_SPIN)).toBeCloseTo(7.15, 5);
    expect(expectedPayout(TREASURE_CHEST)).toBe(78);
    expect(expectedPayout(LUCKY_NUMBER)).toBeCloseTo(17.7, 5);
  });

  it('looks up by key', () => {
    expect(findGame('LUCKY_SPIN')).toBe(LUCKY_SPIN);
    expect(findGame('ROULETTE')).toBeUndefined();
  });
});

describe('resolveRound — weighted games', () => {
  it('walks the table in order', () => {
    expect(resolveRound(LUCKY_SPIN, 0).outcome.key).toBe('MISS');
    expect(resolveRound(LUCKY_SPIN, 4_999).outcome.key).toBe('MISS');
    expect(resolveRound(LUCKY_SPIN, 5_000).outcome.key).toBe('SMALL');
    expect(resolveRound(LUCKY_SPIN, 7_499).outcome.key).toBe('SMALL');
    expect(resolveRound(LUCKY_SPIN, 7_500).outcome.key).toBe('MEDIUM');
    expect(resolveRound(LUCKY_SPIN, 9_999).outcome.key).toBe('JACKPOT');
    expect(resolveRound(LUCKY_SPIN, 9_995).outcome.key).toBe('JACKPOT');
    expect(resolveRound(LUCKY_SPIN, 9_994).outcome.key).toBe('MEGA');
  });

  it('never leaves the treasure chest empty', () => {
    for (const roll of [0, 1, 7_499, 7_500, 9_699, 9_700, 9_999]) {
      expect(resolveRound(TREASURE_CHEST, roll).outcome.payoutBeans).toBeGreaterThan(0);
    }
  });

  it('hands out every outcome across the whole roll space, at the stated rate', () => {
    const seen = new Map<string, number>();
    for (let roll = 0; roll < ROLL_SPACE; roll += 1) {
      const { outcome } = resolveRound(LUCKY_SPIN, roll);
      seen.set(outcome.key, (seen.get(outcome.key) ?? 0) + 1);
    }
    for (const outcome of LUCKY_SPIN.outcomes) {
      expect(seen.get(outcome.key)).toBe(outcome.weight);
    }
  });

  it('rejects a roll outside the space', () => {
    expect(() => resolveRound(LUCKY_SPIN, -1)).toThrow(RangeError);
    expect(() => resolveRound(LUCKY_SPIN, ROLL_SPACE)).toThrow(RangeError);
    expect(() => resolveRound(LUCKY_SPIN, 1.5)).toThrow(RangeError);
  });
});

describe('resolveRound — Lucky Number', () => {
  it('draws uniformly from 1..10', () => {
    const counts = new Map<number, number>();
    for (let roll = 0; roll < ROLL_SPACE; roll += 1) {
      const drawn = resolveRound(LUCKY_NUMBER, roll, 5).drawn!;
      counts.set(drawn, (counts.get(drawn) ?? 0) + 1);
    }
    expect(counts.size).toBe(10);
    for (const count of counts.values()) {
      expect(count).toBe(ROLL_SPACE / 10);
    }
  });

  it('pays the exact hit, the off-by-one, and nothing else', () => {
    // roll % 10 + 1 === 5 when roll ends in 4.
    expect(resolveRound(LUCKY_NUMBER, 4, 5).outcome.key).toBe('EXACT');
    expect(resolveRound(LUCKY_NUMBER, 4, 4).outcome.key).toBe('NEAR');
    expect(resolveRound(LUCKY_NUMBER, 4, 6).outcome.key).toBe('NEAR');
    expect(resolveRound(LUCKY_NUMBER, 4, 7).outcome.key).toBe('MISS');
    expect(resolveRound(LUCKY_NUMBER, 4, 1).outcome.key).toBe('MISS');
  });

  it('rejects a missing or out-of-range pick', () => {
    expect(() => resolveRound(LUCKY_NUMBER, 0)).toThrow(RangeError);
    expect(() => resolveRound(LUCKY_NUMBER, 0, 0)).toThrow(RangeError);
    expect(() => resolveRound(LUCKY_NUMBER, 0, 11)).toThrow(RangeError);
    expect(() => resolveRound(LUCKY_NUMBER, 0, 2.5)).toThrow(RangeError);
  });
});

describe('levels', () => {
  it('start at zero and climb', () => {
    for (const bands of [SENDER_LEVELS, HOST_LEVELS]) {
      expect(bands[0]!.threshold).toBe(0);
      expect(bands[0]!.level).toBe(1);
      for (let i = 1; i < bands.length; i += 1) {
        expect(bands[i]!.threshold).toBeGreaterThan(bands[i - 1]!.threshold);
        expect(bands[i]!.level).toBe(bands[i - 1]!.level + 1);
      }
    }
  });

  it('places a value in its band', () => {
    expect(senderLevel(0).level).toBe(1);
    expect(senderLevel(99).level).toBe(1);
    expect(senderLevel(100).level).toBe(2);
    expect(senderLevel(100).title).toBe('Ember');
    expect(senderLevel(499).level).toBe(2);
    expect(senderLevel(500).level).toBe(3);
    expect(hostLevel(0).title).toBe('Newcomer');
    expect(hostLevel(50_000).title).toBe('Star');
  });

  it('reports progress through the band', () => {
    const mid = senderLevel(300); // band 2 spans 100..500
    expect(mid.level).toBe(2);
    expect(mid.nextThreshold).toBe(500);
    expect(mid.progress).toBeCloseTo(0.5, 5);
  });

  it('tops out cleanly', () => {
    const top = senderLevel(999_999_999);
    expect(top.level).toBe(SENDER_LEVELS.at(-1)!.level);
    expect(top.nextThreshold).toBeNull();
    expect(top.progress).toBe(1);
  });

  it('treats junk input as zero', () => {
    expect(senderLevel(-50).level).toBe(1);
    expect(senderLevel(-50).current).toBe(0);
    expect(senderLevel(100.9).level).toBe(2);
  });
});

describe('fixed economy constants', () => {
  it('match the spec', () => {
    expect(SIGNUP_BONUS_DIAMONDS).toBe(10);
    expect(CLAN_MAX_MEMBERS).toBe(15);
    expect(MIN_CASHOUT_BEANS).toBe(100);
    // Treasure Chest rewards are fixed at 20 / 150 / 1000 beans.
    expect(TREASURE_CHEST.outcomes.map((o) => o.payoutBeans)).toEqual([20, 150, 1_000]);
  });
});
