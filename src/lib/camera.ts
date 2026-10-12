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

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
