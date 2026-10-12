'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GIFT_EFFECT_QUEUE_MAX, effectFor, findGift, type Gift } from '@/lib/economy';

export type GiftEvent = {
  /// Unique per firing, so the same gift twice animates twice.
  id: number;
  giftCode: string;
  quantity: number;
  senderName: string;
  beans: number;
};

const TIER_SKIN: Record<
  Gift['tier'],
  { ring: string; glow: string; text: string; sparkle: string[] }
> = {
  common: {
    ring: 'from-nexus-400/60 to-nexus-700/0',
    glow: 'rgb(139 99 255 / 0.55)',
    text: 'text-nexus-200',
    sparkle: ['#cdc2ff', '#8b63ff'],
  },
  rare: {
    ring: 'from-sky-300/70 to-sky-700/0',
    glow: 'rgb(56 214 255 / 0.6)',
    text: 'text-diamond',
    sparkle: ['#38d6ff', '#a5f0ff', '#7036ff'],
  },
  epic: {
    ring: 'from-fuchsia-400/80 to-fuchsia-800/0',
    glow: 'rgb(255 45 111 / 0.65)',
    text: 'text-live',
    sparkle: ['#ff2d6f', '#ff9ec4', '#ffc53d'],
  },
  legendary: {
    ring: 'from-amber-300/90 to-amber-700/0',
    glow: 'rgb(255 197 61 / 0.75)',
    text: 'text-bean',
    sparkle: ['#ffc53d', '#fff3c4', '#ff2d6f', '#ffffff'],
  },
};

/** Deterministic pseudo-random so a given event animates the same on re-render. */
function seeded(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function Burst({ count, colors, seed, durationMs }: { count: number; colors: string[]; seed: number; durationMs: number }) {
  const particles = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.5;
      const distance = 90 + rand() * 190;
      return {
        key: i,
        dx: `${Math.cos(angle) * distance}px`,
        dy: `${Math.sin(angle) * distance}px`,
        scale: 0.5 + rand() * 1.1,
        delay: rand() * 260,
        size: 5 + Math.round(rand() * 9),
        color: colors[i % colors.length]!,
        dur: durationMs * (0.55 + rand() * 0.4),
      };
    });
  }, [count, colors, seed, durationMs]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.key}
          className="absolute rounded-full animate-particle-fly"
          style={
            {
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              animationDelay: `${p.delay}ms`,
              '--dx': p.dx,
              '--dy': p.dy,
              '--ps': String(p.scale),
              '--dur': `${p.dur}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function CoinRain({ seed, durationMs }: { seed: number; durationMs: number }) {
  const coins = useMemo(() => {
    const rand = seeded(seed + 7);
    return Array.from({ length: 22 }, (_, i) => ({
      key: i,
      left: `${rand() * 100}%`,
      delay: rand() * 900,
      dur: durationMs * (0.6 + rand() * 0.5),
      size: 12 + Math.round(rand() * 14),
    }));
  }, [seed, durationMs]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {coins.map((c) => (
        <span
          key={c.key}
          className="absolute top-0 animate-coin-rain"
          style={
            { left: c.left, fontSize: c.size, animationDelay: `${c.delay}ms`, '--dur': `${c.dur}ms` } as React.CSSProperties
          }
        >
          🪙
        </span>
      ))}
    </div>
  );
}

function OneEffect({ event, onDone }: { event: GiftEvent; onDone: (id: number) => void }) {
  const gift = findGift(event.giftCode);
  const [leaving, setLeaving] = useState(false);

  const effect = gift ? effectFor(gift) : null;
  const skin = gift ? TIER_SKIN[gift.tier] : null;

  useEffect(() => {
    if (!effect) return;
    const exit = window.setTimeout(() => setLeaving(true), Math.max(0, effect.durationMs - 500));
    const done = window.setTimeout(() => onDone(event.id), effect.durationMs);
    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(done);
    };
  }, [effect, event.id, onDone]);

  if (!gift || !effect || !skin) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
        effect.takeover ? 'z-30' : 'z-20'
      }`}
      role="status"
      aria-live="polite"
    >
      {effect.takeover && (
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/55"
          style={{ backdropFilter: 'blur(1.5px)' }}
        />
      )}

      {/* Rotating god-rays behind legendary and epic gifts. */}
      {effect.takeover && (
        <div
          className="absolute h-[140vmin] w-[140vmin] animate-ray-spin opacity-40"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${skin.glow} 12deg, transparent 26deg, transparent 56deg, ${skin.glow} 68deg, transparent 84deg)`,
            maskImage: 'radial-gradient(circle, black 18%, transparent 68%)',
            WebkitMaskImage: 'radial-gradient(circle, black 18%, transparent 68%)',
          }}
          aria-hidden
        />
      )}

      {gift.tier === 'legendary' && <CoinRain seed={event.id} durationMs={effect.durationMs} />}

      <Burst count={effect.particles} colors={skin.sparkle} seed={event.id} durationMs={effect.durationMs} />

      <div className={`relative flex flex-col items-center ${leaving ? 'animate-gift-exit' : 'animate-gift-enter'}`}>
        <div
          className={`absolute -inset-16 rounded-full bg-gradient-to-b ${skin.ring} blur-2xl`}
          aria-hidden
        />
        <span
          className="relative drop-shadow-2xl"
          style={{
            fontSize: effect.takeover ? '7rem' : '4rem',
            filter: `drop-shadow(0 0 28px ${skin.glow})`,
          }}
        >
          {gift.glyph}
        </span>

        {effect.banner && (
          <div className="mt-3 overflow-hidden">
            <div
              className="animate-banner-sweep rounded-md bg-gradient-to-r from-transparent via-white/90 to-transparent px-8 py-1"
              style={{ '--dur': `${effect.durationMs}ms` } as React.CSSProperties}
            >
              <span className="text-sm font-black tracking-[0.35em] text-ink-900">
                {effect.banner}
              </span>
            </div>
          </div>
        )}

        <p className={`mt-2 text-center text-sm font-extrabold ${skin.text} drop-shadow`}>
          {event.senderName} sent {event.quantity > 1 ? `${event.quantity}× ` : ''}
          {gift.name}
        </p>
        {event.beans > 0 && (
          <p className="text-xs font-semibold text-bean/90 drop-shadow">+{event.beans} beans</p>
        )}
      </div>
    </div>
  );
}

/**
 * Overlays gift animations on the stage. Tier drives how loud it is; whether
 * it takes the whole screen comes from the gift itself (see effectFor).
 */
export function GiftEffectLayer({ events, onConsumed }: { events: GiftEvent[]; onConsumed: (id: number) => void }) {
  // Only the newest few animate at once — a gift spam war should not turn into
  // a hundred simultaneous takeovers.
  const visible = events.slice(-GIFT_EFFECT_QUEUE_MAX);
  return (
    <>
      {visible.map((event) => (
        <OneEffect key={event.id} event={event} onDone={onConsumed} />
      ))}
    </>
  );
}

/** Queue plumbing, so a page just calls push() and forgets. */
export function useGiftEffects() {
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const nextId = useRef(1);

  const push = useCallback((event: Omit<GiftEvent, 'id'>) => {
    const id = nextId.current++;
    setEvents((current) => [...current, { ...event, id }].slice(-GIFT_EFFECT_QUEUE_MAX * 2));
    return id;
  }, []);

  const consume = useCallback((id: number) => {
    setEvents((current) => current.filter((e) => e.id !== id));
  }, []);

  return { events, push, consume };
}
