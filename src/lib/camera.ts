/**
 * Camera presets for the broadcast stage.
 *
 * These are CSS filters applied to the local <video>, so they are real and
 * free — but they are a look, not a beauty model: nothing here reshapes a
 * face. The preview and the published track would need the same filter baked
 * in via a canvas pipeline once LiveKit is publishing.
 */

export type CameraFilter = {
  id: string;
  label: string;
  /// Valid CSS `filter` value. 'none' for the untouched camera.
  css: string;
};

export const CAMERA_FILTERS: readonly CameraFilter[] = [
  { id: 'none', label: 'None', css: 'none' },
  { id: 'soft', label: 'Soft', css: 'saturate(1.1) contrast(0.95) brightness(1.08) blur(0.4px)' },
  { id: 'glow', label: 'Glow', css: 'saturate(1.25) brightness(1.15) contrast(0.92)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.28) saturate(1.3) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(-12deg) saturate(1.2) brightness(1.04)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.1)' },
  { id: 'neon', label: 'Neon', css: 'saturate(1.9) contrast(1.2) hue-rotate(8deg)' },
  { id: 'film', label: 'Film', css: 'sepia(0.15) contrast(1.15) saturate(0.9) brightness(0.98)' },
] as const;

export const DEFAULT_FILTER_ID = 'none';

export function filterCss(id: string): string {
  return CAMERA_FILTERS.find((f) => f.id === id)?.css ?? 'none';
}

/** Ideal constraints. The browser will give us the nearest it can. */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

/** Echo cancellation matters most: a guest on a seat hears the host's audio. */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * What to ask getUserMedia for, in order.
 *
 * Asking for camera *and* mic in one call is all-or-nothing: a laptop with no
 * webcam, or a camera another app already holds, rejects the whole request and
 * the microphone never opens either. So we walk down: both, then mic alone,
 * then camera alone.
 */
export type MediaWish = { video: boolean; audio: boolean };

export const MEDIA_FALLBACKS: readonly MediaWish[] = [
  { video: true, audio: true },
  { video: false, audio: true },
  { video: true, audio: false },
] as const;

/** Error names that mean "this device cannot do it" — worth trying less. */
const RETRYABLE = new Set([
  'NotFoundError',
  'DevicesNotFoundError',
  'NotReadableError',
  'TrackStartError',
  'OverconstrainedError',
  'ConstraintNotSatisfiedError',
]);

/** A refused permission applies to the whole origin: retrying cannot help. */
export function canRetryWithLess(err: unknown): boolean {
  return err instanceof DOMException && RETRYABLE.has(err.name);
}

/**
 * Plain-language cause, so "not working" always comes with a next step rather
 * than a silent dead preview.
 */
export function describeMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera and microphone access was blocked. Allow it for this site in your browser settings, then try again.';
    case 'SecurityError':
      return 'Your browser blocked the camera on this page. It needs a secure (https) connection.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera or microphone is already in use by another app. Close it and try again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'That camera could not be opened with these settings. Pick a different one.';
    case 'AbortError':
      return 'The camera stopped before it started. Try again.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Could not open the camera or microphone.';
  }
}

/** Why no device can open at all, or null when the page is able to ask. */
export function mediaUnavailableReason(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) {
    return 'Camera and microphone need a secure connection. Open this site over https.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot open a camera or microphone.';
  }
  return null;
}

/** Microphone meter tuning — a visible needle is the only proof a mic is live. */
export const MIC_METER = {
  fftSize: 512,
  /// RMS is tiny for speech; scale it into something a bar can show.
  gain: 2.6,
  /// Below this the bar reads silent, so room noise does not look like speech.
  floor: 0.012,
} as const;

/** RMS of a time-domain buffer, scaled and clamped to 0..1 for the meter. */
export function micLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  const rms = Math.sqrt(sum / samples.length);
  if (rms < MIC_METER.floor) return 0;
  return Math.min(1, rms * MIC_METER.gain);
}
