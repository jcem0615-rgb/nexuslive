'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_CONSTRAINTS,
  CAMERA_FILTERS,
  DEFAULT_FILTER_ID,
  VIDEO_CONSTRAINTS,
  filterCss,
} from '@/lib/camera';

type Props = {
  /// Host sees their own camera; a guest on a seat does too.
  canBroadcast: boolean;
  hostName: string;
  onStateChange?: (state: { camera: boolean; mic: boolean }) => void;
};

/**
 * The broadcast stage.
 *
 * The camera, microphone, device switching and filters here are real
 * getUserMedia — they work now. What is not here is anybody else's video:
 * publishing and subscribing needs LiveKit (Phase 8), and until that lands
 * this shows your own preview and seats show avatars.
 */
export function LiveStage({ canBroadcast, hostName, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [live, setLive] = useState(false);
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [filter, setFilter] = useState(DEFAULT_FILTER_ID);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }, []);

  // Tracks are a real device handle: always release them on unmount, or the
  // camera light stays on after navigating away.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    onStateChange?.({ camera, mic });
  }, [camera, mic, onStateChange]);

  const start = useCallback(
    async (preferredDeviceId?: string) => {
      setBusy(true);
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser cannot open a camera.');
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...VIDEO_CONSTRAINTS,
            ...(preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : {}),
          },
          audio: AUDIO_CONSTRAINTS,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        stream.getVideoTracks().forEach((t) => (t.enabled = camera));
        stream.getAudioTracks().forEach((t) => (t.enabled = mic));
        setLive(true);

        // Labels are blank until permission is granted, so enumerate after.
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === 'videoinput'));
        setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera and microphone access was blocked. Allow it in your browser, then try again.'
            : name === 'NotFoundError'
              ? 'No camera found on this device.'
              : err instanceof Error
                ? err.message
                : 'Could not open the camera.',
        );
        setLive(false);
      } finally {
        setBusy(false);
      }
    },
    [camera, mic],
  );

  function toggleCamera() {
    const next = !camera;
    setCamera(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  }

  function toggleMic() {
    const next = !mic;
    setMic(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  }

  async function switchCamera(id: string) {
    setDeviceId(id);
    await start(id);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-nexus-800/60 via-ink-800 to-ink-900">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          live && camera ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          filter: filterCss(filter),
          transform: mirror ? 'scaleX(-1)' : undefined,
        }}
      />

      {/* Idle / camera-off state */}
      {(!live || !camera) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-3xl">
            {live && !camera ? '🚫' : '🎥'}
          </div>
          <p className="text-sm font-semibold text-slate-200">
            {live && !camera ? 'Your camera is off' : hostName}
          </p>
          {!live && canBroadcast && (
            <>
              <p className="max-w-xs text-xs text-slate-400">
                Turn your camera on to go on stage. Nothing is published to viewers yet — video
                transport lands with LiveKit.
              </p>
              <button type="button" onClick={() => start()} disabled={busy} className="btn-live mt-1">
                {busy ? 'Starting…' : 'Start camera'}
              </button>
            </>
          )}
          {!live && !canBroadcast && (
            <p className="max-w-xs text-xs text-slate-500">
              Take a seat to join the stage.
            </p>
          )}
          {error && (
            <p role="alert" className="max-w-xs text-xs font-medium text-live">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Controls */}
      {live && (
        <div
          className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <ControlButton active={camera} onClick={toggleCamera} label={camera ? 'Camera on' : 'Camera off'}>
            {camera ? '🎥' : '🚫'}
          </ControlButton>
          <ControlButton active={mic} onClick={toggleMic} label={mic ? 'Mic on' : 'Mic muted'}>
            {mic ? '🎙️' : '🔇'}
          </ControlButton>
          <ControlButton active={mirror} onClick={() => setMirror((m) => !m)} label="Mirror">
            🪞
          </ControlButton>
          <ControlButton
            active={filter !== 'none'}
            onClick={() => setShowFilters((v) => !v)}
            label="Filters"
          >
            ✨
          </ControlButton>
          {devices.length > 1 && (
            <select
              value={deviceId ?? ''}
              onChange={(e) => switchCamera(e.target.value)}
              className="max-w-[9rem] rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white"
              aria-label="Camera"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={stop} className="btn-ghost px-3 py-1.5 text-xs">
            Stop
          </button>
        </div>
      )}

      {/* Filter tray */}
      {live && showFilters && (
        <div className="no-scrollbar absolute inset-x-0 bottom-16 flex gap-2 overflow-x-auto px-3 pb-2">
          {CAMERA_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.id
                  ? 'border-nexus-400 bg-nexus-500/30 text-white'
                  : 'border-white/10 bg-black/50 text-slate-300 hover:bg-black/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full border text-base transition ${
        active
          ? 'border-white/20 bg-white/15 text-white'
          : 'border-live/40 bg-live/20 text-live'
      }`}
    >
      {children}
    </button>
  );
}
