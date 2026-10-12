import { describe, expect, it } from 'vitest';
import {
  CAMERA_FILTERS,
  DEFAULT_FILTER_ID,
  MEDIA_FALLBACKS,
  MIC_METER,
  canRetryWithLess,
  describeMediaError,
  filterCss,
  micLevel,
} from './camera';

describe('filters', () => {
  it('has a default that exists and is the untouched camera', () => {
    const fallback = CAMERA_FILTERS.find((f) => f.id === DEFAULT_FILTER_ID);
    expect(fallback?.css).toBe('none');
  });

  it('uses unique ids', () => {
    expect(new Set(CAMERA_FILTERS.map((f) => f.id)).size).toBe(CAMERA_FILTERS.length);
  });

  it('resolves every id to its css, and anything else to none', () => {
    for (const f of CAMERA_FILTERS) expect(filterCss(f.id)).toBe(f.css);
    expect(filterCss('does-not-exist')).toBe('none');
  });
});

describe('MEDIA_FALLBACKS', () => {
  it('asks for both first', () => {
    expect(MEDIA_FALLBACKS[0]).toEqual({ video: true, audio: true });
  });

  it('can still reach the mic when the camera is the broken half', () => {
    expect(MEDIA_FALLBACKS.some((w) => w.audio && !w.video)).toBe(true);
  });

  it('can still reach the camera when the mic is the broken half', () => {
    expect(MEDIA_FALLBACKS.some((w) => w.video && !w.audio)).toBe(true);
  });

  it('never asks for nothing', () => {
    for (const wish of MEDIA_FALLBACKS) expect(wish.video || wish.audio).toBe(true);
  });
});

describe('canRetryWithLess', () => {
  it('retries when a device is missing, busy or over-constrained', () => {
    for (const name of [
      'NotFoundError',
      'DevicesNotFoundError',
      'NotReadableError',
      'TrackStartError',
      'OverconstrainedError',
      'ConstraintNotSatisfiedError',
    ]) {
      expect(canRetryWithLess(new DOMException('', name)), name).toBe(true);
    }
  });

  it('does not retry a refused permission — that is origin-wide', () => {
    expect(canRetryWithLess(new DOMException('', 'NotAllowedError'))).toBe(false);
    expect(canRetryWithLess(new DOMException('', 'SecurityError'))).toBe(false);
  });

  it('does not retry on a non-DOMException', () => {
    expect(canRetryWithLess(new Error('NotFoundError'))).toBe(false);
    expect(canRetryWithLess(null)).toBe(false);
  });
});

describe('describeMediaError', () => {
  it('tells a blocked permission apart from a missing device', () => {
    expect(describeMediaError(new DOMException('', 'NotAllowedError'))).toMatch(/blocked/i);
    expect(describeMediaError(new DOMException('', 'NotFoundError'))).toMatch(/No camera/i);
    expect(describeMediaError(new DOMException('', 'NotReadableError'))).toMatch(/another app/i);
  });

  it('always ends up with something actionable, never empty', () => {
    for (const err of [
      new DOMException('', 'NotAllowedError'),
      new DOMException('', 'SecurityError'),
      new DOMException('', 'NotFoundError'),
      new DOMException('', 'NotReadableError'),
      new DOMException('', 'OverconstrainedError'),
      new DOMException('', 'AbortError'),
      new DOMException('', 'SomethingBrandNew'),
      new Error('socket hung up'),
      'a string',
      undefined,
    ]) {
      expect(describeMediaError(err).length).toBeGreaterThan(10);
    }
  });

  it('passes a plain Error message through', () => {
    expect(describeMediaError(new Error('socket hung up'))).toBe('socket hung up');
  });
});

describe('micLevel', () => {
  const buffer = (fill: (i: number) => number, n = MIC_METER.fftSize) =>
    Float32Array.from({ length: n }, (_, i) => fill(i));

  it('reads silence as zero', () => {
    expect(micLevel(buffer(() => 0))).toBe(0);
  });

  it('reads an empty buffer as zero rather than NaN', () => {
    expect(micLevel(new Float32Array(0))).toBe(0);
  });

  it('treats a whisper below the floor as silence', () => {
    expect(micLevel(buffer(() => MIC_METER.floor / 2))).toBe(0);
  });

  it('rises with volume', () => {
    const quiet = micLevel(buffer(() => 0.05));
    const loud = micLevel(buffer(() => 0.4));
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
  });

  it('clamps a full-scale signal to 1 so the bar cannot overflow', () => {
    expect(micLevel(buffer((i) => (i % 2 ? 1 : -1)))).toBe(1);
  });

  it('stays inside 0..1 for every signal', () => {
    for (const fill of [
      () => -1,
      () => 1,
      (i: number) => Math.sin(i / 3),
      (i: number) => (i % 7) - 3,
    ]) {
      const level = micLevel(buffer(fill));
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  it('ignores sign — a negative swing is just as loud', () => {
    expect(micLevel(buffer(() => -0.3))).toBe(micLevel(buffer(() => 0.3)));
  });
});
