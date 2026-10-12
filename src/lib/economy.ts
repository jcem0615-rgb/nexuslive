/**
 * Nexus Live economy — the single source of every rate, price, odd and formula.
 *
 * Rule 6: nothing in a route handler or a component may hardcode a number that
 * belongs here. Everything in this file is pure and synchronous so it can be
 * unit tested without a database; if you change a number, update
 * `economy.test.ts` in the same commit.
 *
 * Two wallets, and they never mix (rule 3):
 *   purchased diamonds — bought with money, spend-only, never cashable
 *   earned diamonds (beans) — from gifts received and game wins, the only
 *                             balance that can be cashed out
 */

// ---------------------------------------------------------------------------
// Wallet bootstrap
// ---------------------------------------------------------------------------

/** Credited at signup through adjustWallet so it shows up in the ledger. */
export const SIGNUP_BONUS_DIAMONDS = 10;

/** Claimable once per UTC day. */
export const DAILY_BONUS_DIAMONDS = 5;

// ---------------------------------------------------------------------------
// Diamond packs (top-ups). Prices are in US cents, integers only.
// ---------------------------------------------------------------------------

export type DiamondPack = {
  code: string;
  diamonds: number;
  /** Extra diamonds thrown in on the bigger packs. */
  bonus: number;
  priceCents: number;
  popular?: boolean;
};

export const DIAMOND_PACKS: readonly DiamondPack[] = [
  { code: 'starter', diamonds: 70, bonus: 0, priceCents: 99 },
  { code: 'mini', diamonds: 350, bonus: 10, priceCents: 499 },
  { code: 'standard', diamonds: 700, bonus: 35, priceCents: 999, popular: true },
  { code: 'plus', diamonds: 1_400, bonus: 110, priceCents: 1_999 },
  { code: 'pro', diamonds: 3_500, bonus: 400, priceCents: 4_999 },
  { code: 'whale', diamonds: 7_000, bonus: 1_050, priceCents: 9_999 },
] as const;

export function findPack(code: string): DiamondPack | undefined {
  return DIAMOND_PACKS.find((p) => p.code === code);
}

/** What a pack actually drops into `purchased_diamonds`. */
export function packTotalDiamonds(pack: DiamondPack): number {
  return pack.diamonds + pack.bonus;
}

// ---------------------------------------------------------------------------
// Gifts
// ---------------------------------------------------------------------------

export type GiftTier = 'common' | 'rare' | 'epic' | 'legendary';

export type Gift = {
  code: string;
  name: string;
  /** Cost to the sender, in purchased diamonds, for one unit. */
  diamonds: number;
  tier: GiftTier;
  /** Rendered in the gift tray and the stream overlay. */
  glyph: string;
  /** Full-screen takeover animation on the receiving stream. */
  fullscreen: boolean;
};

export const GIFTS: readonly Gift[] = [
  { code: 'rose', name: 'Rose', diamonds: 5, tier: 'common', glyph: '🌹', fullscreen: false },
  { code: 'heart', name: 'Heart', diamonds: 15, tier: 'common', glyph: '💖', fullscreen: false },
  { code: 'teddy', name: 'Teddy Bear', diamonds: 50, tier: 'common', glyph: '🧸', fullscreen: false },
  { code: 'crown', name: 'Crown', diamonds: 99, tier: 'rare', glyph: '👑', fullscreen: false },
  { code: 'fireworks', name: 'Fireworks', diamonds: 199, tier: 'rare', glyph: '🎆', fullscreen: true },
  { code: 'dragon', name: 'Dragon', diamonds: 499, tier: 'epic', glyph: '🐉', fullscreen: true },
  { code: 'sportscar', name: 'Sports Car', diamonds: 999, tier: 'epic', glyph: '🏎️', fullscreen: true },
  { code: 'yacht', name: 'Yacht', diamonds: 2_999, tier: 'legendary', glyph: '🛥️', fullscreen: true },
  { code: 'castle', name: 'Castle', diamonds: 9_999, tier: 'legendary', glyph: '🏰', fullscreen: true },
] as const;

export function findGift(code: string): Gift | undefined {
  return GIFTS.find((g) => g.code === code);
}

/** Most diamonds that can go out in a single gift send. */
export const MAX_GIFT_QUANTITY = 99;

/**
 * Share of a gift's diamond cost the receiver keeps, as beans.
 * The remainder is the platform's cut.
 */
export const GIFT_BEAN_RATE = 0.6;

/** Beans credited to the receiver for a gift send. Always rounded down. */
export function beansForGift(diamondCost: number): number {
  return Math.floor(diamondCost * GIFT_BEAN_RATE);
}

/** Clan points earned by the *sender's* clan per diamond gifted. */
export const CLAN_POINTS_PER_DIAMOND = 1;

export function clanPointsForGift(diamondCost: number): number {
  return diamondCost * CLAN_POINTS_PER_DIAMOND;
}

// ---------------------------------------------------------------------------
// Cash-out (beans -> money)
// ---------------------------------------------------------------------------

/** Beans that make up one US dollar. */
export const BEANS_PER_USD = 210;

/** Platform's cut of a payout, taken off the gross. */
export const CASHOUT_FEE_RATE = 0.1;

/**
 * Smallest withdrawal. Placeholder — the spec doesn't set one, see the
 * deviation note in CLAUDE.md.
 */
export const MIN_CASHOUT_BEANS = 100;

/** One pending request at a time, per user. */
export const MAX_PENDING_CASHOUTS = 1;

export type CashoutQuote = {
  beans: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
};

/**
 * Integer-only money maths: the gross rounds down to the cent and the fee
 * rounds up, so the platform never pays out a fraction it didn't collect.
 */
export function quoteCashout(beans: number): CashoutQuote {
  const grossCents = Math.floor((beans * 100) / BEANS_PER_USD);
  const feeCents = Math.ceil(grossCents * CASHOUT_FEE_RATE);
  return { beans, grossCents, feeCents, netCents: grossCents - feeCents };
}

// ---------------------------------------------------------------------------
// Mini-games
//
// Rule 7: the server draws the roll with crypto.randomInt(0, ROLL_SPACE) and
// hands it to the resolver below. The client never sends an outcome, and the
// roll is stored on the GameRound so a payout can be re-checked later.
// ---------------------------------------------------------------------------

/** Every game rolls one integer in [0, ROLL_SPACE). */
export const ROLL_SPACE = 10_000;

export type GameKey = 'LUCKY_SPIN' | 'TREASURE_CHEST' | 'LUCKY_NUMBER';

export type GameOutcome = {
  key: string;
  label: string;
  /** Beans credited to the player's cashable wallet. */
  payoutBeans: number;
  /** Chance out of ROLL_SPACE. */
  weight: number;
};

export type GameDef = {
  key: GameKey;
  name: string;
  blurb: string;
  /** Purchased diamonds taken per round. */
  costDiamonds: number;
  /** True when the player chooses a number (1..pickRange). */
  pickRange?: number;
  outcomes: readonly GameOutcome[];
};

export const LUCKY_SPIN: GameDef = {
  key: 'LUCKY_SPIN',
  name: 'Lucky Spin',
  blurb: 'Ten diamonds a spin. Seven segments, one jackpot.',
  costDiamonds: 10,
  outcomes: [
    { key: 'MISS', label: 'Try again', payoutBeans: 0, weight: 5_000 },
    { key: 'SMALL', label: '5 beans', payoutBeans: 5, weight: 2_500 },
    { key: 'MEDIUM', label: '10 beans', payoutBeans: 10, weight: 1_500 },
    { key: 'LARGE', label: '25 beans', payoutBeans: 25, weight: 700 },
    { key: 'SUPER', label: '50 beans', payoutBeans: 50, weight: 250 },
    { key: 'MEGA', label: '200 beans', payoutBeans: 200, weight: 45 },
    { key: 'JACKPOT', label: 'JACKPOT — 1000 beans', payoutBeans: 1_000, weight: 5 },
  ],
};

export const TREASURE_CHEST: GameDef = {
  key: 'TREASURE_CHEST',
  name: 'Treasure Chest',
  blurb: 'A hundred diamonds, and the chest is never empty.',
  costDiamonds: 100,
  outcomes: [
    { key: 'BRONZE', label: 'Bronze chest — 20 beans', payoutBeans: 20, weight: 7_500 },
    { key: 'SILVER', label: 'Silver chest — 150 beans', payoutBeans: 150, weight: 2_200 },
    { key: 'GOLD', label: 'Gold chest — 1000 beans', payoutBeans: 1_000, weight: 300 },
  ],
};

export const LUCKY_NUMBER: GameDef = {
  key: 'LUCKY_NUMBER',
  name: 'Lucky Number',
  blurb: 'Call a number from 1 to 10. Land it for 150 beans, miss by one for 15.',
  costDiamonds: 20,
  pickRange: 10,
  outcomes: [
    { key: 'EXACT', label: 'Exact hit — 150 beans', payoutBeans: 150, weight: 1_000 },
    { key: 'NEAR', label: 'Off by one — 15 beans', payoutBeans: 15, weight: 1_800 },
    { key: 'MISS', label: 'No luck', payoutBeans: 0, weight: 7_200 },
  ],
};

export const GAMES: Record<GameKey, GameDef> = {
  LUCKY_SPIN: LUCKY_SPIN,
  TREASURE_CHEST: TREASURE_CHEST,
  LUCKY_NUMBER: LUCKY_NUMBER,
};

export const GAME_LIST: readonly GameDef[] = [LUCKY_SPIN, TREASURE_CHEST, LUCKY_NUMBER];

export function findGame(key: string): GameDef | undefined {
  return (GAME_LIST as GameDef[]).find((g) => g.key === key);
}

export type ResolvedRound = {
  outcome: GameOutcome;
  /** The number the server drew, for games that show one. */
  drawn?: number;
};

/**
 * Map a server roll onto an outcome.
 *
 * Weighted games walk the outcome table. Lucky Number instead turns the roll
 * into a drawn number (ROLL_SPACE is a multiple of 10, so the draw is uniform)
 * and compares it with the player's pick.
 */
export function resolveRound(game: GameDef, roll: number, pick?: number): ResolvedRound {
  if (!Number.isInteger(roll) || roll < 0 || roll >= ROLL_SPACE) {
    throw new RangeError(`roll must be an integer in [0, ${ROLL_SPACE})`);
  }

  if (game.pickRange) {
    if (!Number.isInteger(pick) || pick === undefined || pick < 1 || pick > game.pickRange) {
      throw new RangeError(`pick must be an integer in [1, ${game.pickRange}]`);
    }
    const drawn = (roll % game.pickRange) + 1;
    const gap = Math.abs(drawn - pick);
    const key = gap === 0 ? 'EXACT' : gap === 1 ? 'NEAR' : 'MISS';
    const outcome = game.outcomes.find((o) => o.key === key);
    if (!outcome) throw new Error(`game ${game.key} is missing outcome ${key}`);
    return { outcome, drawn };
  }

  let cursor = roll;
  for (const outcome of game.outcomes) {
    if (cursor < outcome.weight) return { outcome };
    cursor -= outcome.weight;
  }
  throw new Error(`game ${game.key} outcome weights do not add up to ${ROLL_SPACE}`);
}

/** Expected beans per round, for the house-edge reporting in the portal. */
export function expectedPayout(game: GameDef): number {
  if (game.pickRange) {
    // Averaged over every pick, since the edge depends on edge-of-range picks
    // having one neighbour instead of two.
    const picks = Array.from({ length: game.pickRange }, (_, i) => i + 1);
    const total = picks.reduce((sum, pick) => {
      const exact = game.outcomes.find((o) => o.key === 'EXACT')?.payoutBeans ?? 0;
      const near = game.outcomes.find((o) => o.key === 'NEAR')?.payoutBeans ?? 0;
      const neighbours = [pick - 1, pick + 1].filter((n) => n >= 1 && n <= game.pickRange!).length;
      return sum + (exact + near * neighbours) / game.pickRange!;
    }, 0);
    return total / game.pickRange;
  }
  const weighted = game.outcomes.reduce((sum, o) => sum + o.payoutBeans * o.weight, 0);
  return weighted / ROLL_SPACE;
}

// ---------------------------------------------------------------------------
// Clans
// ---------------------------------------------------------------------------

/** Hard cap, enforced by locking the clan row in the join route. */
export const CLAN_MAX_MEMBERS = 15;

/** Purchased diamonds burned to found a clan. */
export const CLAN_CREATE_COST = 1_000;

export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 24;
export const CLAN_TAG_MIN = 2;
export const CLAN_TAG_MAX = 5;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type LevelBand = { level: number; title: string; threshold: number };

/** Sender level, from lifetime purchased diamonds spent. */
export const SENDER_LEVELS: readonly LevelBand[] = [
  { level: 1, title: 'Spark', threshold: 0 },
  { level: 2, title: 'Ember', threshold: 100 },
  { level: 3, title: 'Flame', threshold: 500 },
  { level: 4, title: 'Blaze', threshold: 2_000 },
  { level: 5, title: 'Comet', threshold: 10_000 },
  { level: 6, title: 'Nova', threshold: 50_000 },
  { level: 7, title: 'Pulsar', threshold: 200_000 },
  { level: 8, title: 'Quasar', threshold: 1_000_000 },
  { level: 9, title: 'Nebula', threshold: 5_000_000 },
  { level: 10, title: 'Nexus', threshold: 20_000_000 },
] as const;

/** Host level, from lifetime beans received. */
export const HOST_LEVELS: readonly LevelBand[] = [
  { level: 1, title: 'Newcomer', threshold: 0 },
  { level: 2, title: 'Rising', threshold: 500 },
  { level: 3, title: 'Featured', threshold: 2_500 },
  { level: 4, title: 'Popular', threshold: 10_000 },
  { level: 5, title: 'Star', threshold: 50_000 },
  { level: 6, title: 'Superstar', threshold: 250_000 },
  { level: 7, title: 'Icon', threshold: 1_000_000 },
  { level: 8, title: 'Legend', threshold: 5_000_000 },
] as const;

export type LevelProgress = {
  level: number;
  title: string;
  current: number;
  /** Null once the top band is reached. */
  nextThreshold: number | null;
  /** 0..1 through the current band; 1 at the top band. */
  progress: number;
};

export function levelFor(bands: readonly LevelBand[], value: number): LevelProgress {
  const safe = Math.max(0, Math.floor(value));
  let index = 0;
  for (let i = 0; i < bands.length; i += 1) {
    if (safe >= bands[i]!.threshold) index = i;
  }
  const band = bands[index]!;
  const next = bands[index + 1];
  if (!next) {
    return { level: band.level, title: band.title, current: safe, nextThreshold: null, progress: 1 };
  }
  const span = next.threshold - band.threshold;
  return {
    level: band.level,
    title: band.title,
    current: safe,
    nextThreshold: next.threshold,
    progress: span <= 0 ? 1 : Math.min(1, (safe - band.threshold) / span),
  };
}

export const senderLevel = (totalSpent: number) => levelFor(SENDER_LEVELS, totalSpent);
export const hostLevel = (totalEarned: number) => levelFor(HOST_LEVELS, totalEarned);

// ---------------------------------------------------------------------------
// Live stage: seats
// ---------------------------------------------------------------------------

/// Guest seats beside the host. The host is not one of these.
export const STREAM_SEAT_COUNT = 4;

/// An invite to a specific person expires, so a locked-up seat frees itself.
export const SEAT_INVITE_TTL_MINUTES = 2;

// ---------------------------------------------------------------------------
// Content policy and the strike ladder
//
// Enforcement is escalating and offence-numbered: users.strike_count only ever
// goes up, so serving a restriction never buys back a lower rung.
// ---------------------------------------------------------------------------

export const CONTENT_POLICY_TITLE = 'No nudity on camera';

export const CONTENT_POLICY_BODY =
  'Showing private parts of the body, undressing, or any sexual content on a ' +
  'stream is not allowed. Breaking this restricts your account, and a third ' +
  'offence is a permanent ban.';

export type StrikeOutcome = {
  offence: number;
  action: 'RESTRICT' | 'BAN';
  /// Hours the account is restricted for. Null on a ban.
  hours: number | null;
  label: string;
};

export const STRIKE_LADDER: readonly StrikeOutcome[] = [
  { offence: 1, action: 'RESTRICT', hours: 1, label: 'Restricted for 1 hour' },
  { offence: 2, action: 'RESTRICT', hours: 24 * 7, label: 'Restricted for 1 week' },
  {
    offence: 3,
    action: 'BAN',
    hours: null,
    label: 'Permanently banned, balances forfeited to the platform',
  },
] as const;

/**
 * The rung for a given offence number.
 *
 * Anything at or beyond the last rung is a ban — a fourth offence cannot be
 * softer than a third, and there is no rung to fall off the end of.
 */
export function strikeFor(offenceNumber: number): StrikeOutcome {
  if (!Number.isInteger(offenceNumber) || offenceNumber < 1) {
    throw new RangeError('offenceNumber must be a positive integer');
  }
  const last = STRIKE_LADDER[STRIKE_LADDER.length - 1]!;
  const rung = STRIKE_LADDER[offenceNumber - 1];
  return rung ? { ...rung } : { ...last, offence: offenceNumber };
}

/// A ban moves the banned account's balances to the owner. Both wallets move
/// separately — a forfeit never turns diamonds into beans (rule 3).
export const BAN_FORFEITS_BALANCES = true;

// ---------------------------------------------------------------------------
// Gift effects
//
// How loud a gift lands on screen. Tier drives it so the catalogue and the
// animation can never disagree about what "legendary" looks like.
// ---------------------------------------------------------------------------

/// How hard a tier hits. Deliberately says nothing about taking the screen
/// over: Crown and Fireworks are both `rare` but only one is full-screen, so
/// tier cannot decide that — the gift's own `fullscreen` flag does.
export type GiftIntensity = {
  /// How long the overlay holds.
  durationMs: number;
  /// Particles in the burst.
  particles: number;
  /// Banner across the stage; null means glyph only.
  banner: string | null;
  /// Screen shake amplitude in pixels. 0 for none.
  shake: number;
};

export const GIFT_TIER_INTENSITY: Record<GiftTier, GiftIntensity> = {
  common: { durationMs: 1_800, particles: 10, banner: null, shake: 0 },
  rare: { durationMs: 2_600, particles: 26, banner: null, shake: 2 },
  epic: { durationMs: 3_800, particles: 48, banner: 'EPIC GIFT', shake: 6 },
  legendary: { durationMs: 5_200, particles: 80, banner: 'LEGENDARY', shake: 10 },
};

export type GiftEffect = GiftIntensity & { takeover: boolean };

/**
 * The one way to get a gift's effect. Composed rather than stored so the
 * catalogue stays the single source of truth for which gifts take the screen.
 */
export function effectFor(gift: Gift): GiftEffect {
  return { ...GIFT_TIER_INTENSITY[gift.tier], takeover: gift.fullscreen };
}

/// Most gift overlays queued at once before the oldest is dropped.
export const GIFT_EFFECT_QUEUE_MAX = 4;

// ---------------------------------------------------------------------------
// Rate limits and other operational numbers
// ---------------------------------------------------------------------------

export const CHAT_MESSAGE_MAX_LENGTH = 300;
export const CHAT_RATE_PER_MINUTE = 20;
export const STREAM_TITLE_MAX_LENGTH = 80;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RESET_TTL_MINUTES = 15;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const BCRYPT_COST = 12;

/** Formatting helper for money held in cents. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
