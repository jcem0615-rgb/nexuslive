'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_CONSTRAINTS,
  CAMERA_FILTERS,
  DEFAULT_FILTER_ID,
  MEDIA_FALLBACKS,
  MIC_METER,
  VIDEO_CONSTRAINTS,
  canRetryWithLess,
  describeMediaError,
  filterCss,
  mediaUnavailableReason,
  micLevel,
} from '@/lib/camera';

export type SelfView = {
  stream: MediaStream | null;
  /// Mirror and filter travel with the stream: a seat preview of your own
  /// camera has to look like the stage preview did, or it reads as a bug.
  filter: string;
  mirror: boolean;
  cameraOn: boolean;
};

type Props = {
  /// Host sees their own camera; a guest on a seat does too.
  canBroadcast: boolean;
  hostName: string;
  /**
   * Whose stage this is. A host broadcasts to the whole stage; a guest on a
   * seat does not get to take it over — their self-view belongs in their seat,
   * which is where `onSelfView` sends it.
   */
  ownsStage: boolean;
  onSelfView?: (view: SelfView) => void;
  onStateChange?: (state: { camera: boolean; mic: boolean }) => void;
};

type Got = { video: boolean; audio: boolean };

/**
 * The broadcast stage.
 *
 * The camera, microphone, device switching and filters here are real
 * getUserMedia — they work now. What is not here is anybody else's video:
 * publishing and subscribing needs LiveKit (Phase 8), and until that lands
 * this shows your own preview and seats show avatars.
 */
export function LiveStage({ canBroadcast, hostName, ownsStage, onSelfView, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<HTMLDivElement>(null);

  // Bumped by every start() and stop(). A getUserMedia that resolves after a
  // newer one started belongs to a dead generation: drop its tracks instead of
  // letting them clobber the live preview (and leave the camera light on).
  const genRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  const [live, setLive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [got, setGot] = useState<Got>({ video: false, audio: false });
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [filter, setFilter] = useState(DEFAULT_FILTER_ID);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | undefined>();
  const [micId, setMicId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Why the browser can't even be asked (http page, no getUserMedia). Checked
  // on the client only — window does not exist while this renders on the server.
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => setBlocked(mediaUnavailableReason()), []);

  const stopMeter = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (meterRef.current) meterRef.current.style.transform = 'scaleX(0)';
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    stopMeter();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setLive(false);
    setGot({ video: false, audio: false });
  }, [stopMeter]);

  // Tracks are a real device handle: always release them on unmount, or the
  // camera light stays on after navigating away.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    onStateChange?.({ camera, mic });
  }, [camera, mic, onStateChange]);

  // Hand the live stream to whoever is drawing it — for a guest that is their
  // own seat tile, not the host's stage.
  useEffect(() => {
    onSelfView?.({ stream, filter: filterCss(filter), mirror, cameraOn: camera });
  }, [stream, filter, mirror, camera, onSelfView]);

  /**
   * Drive the level bar straight from the analyser.
   *
   * This writes to the DOM node rather than React state on purpose: it runs
   * every animation frame, and 60 re-renders a second of the whole stage would
   * be absurd for one bar.
   */
  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      // Safari hands back a suspended context; start() runs from a tap, so
      // this resume is allowed.
      void ctx.resume().catch(() => undefined);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = MIC_METER.fftSize;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        const node = meterRef.current;
        if (node) node.style.transform = `scaleX(${micLevel(samples)})`;
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    },
    [stopMeter],
  );

  const start = useCallback(
    async (prefer?: { cameraId?: string; micId?: string }) => {
      setBusy(true);
      setError(null);

      const reason = mediaUnavailableReason();
      if (reason) {
        setBlocked(reason);
        setError(reason);
        setBusy(false);
        return;
      }

      const gen = (genRef.current += 1);
      stopMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);

      const video: MediaTrackConstraints = {
        ...VIDEO_CONSTRAINTS,
        ...(prefer?.cameraId ? { deviceId: { exact: prefer.cameraId } } : {}),
      };
      const audio: MediaTrackConstraints = {
        ...AUDIO_CONSTRAINTS,
        ...(prefer?.micId ? { deviceId: { exact: prefer.micId } } : {}),
      };

      // Both, then mic alone, then camera alone: one missing device must not
      // take the other down with it (MEDIA_FALLBACKS explains why).
      let opened: MediaStream | null = null;
      let last: unknown = null;
      for (const wish of MEDIA_FALLBACKS) {
        try {
          opened = await navigator.mediaDevices.getUserMedia({
            video: wish.video ? video : false,
            audio: wish.audio ? audio : false,
          });
          break;
        } catch (err) {
          last = err;
          if (!canRetryWithLess(err)) break;
        }
      }

      if (gen !== genRef.current) {
        // A newer start(), or a stop(), overtook us while we were waiting.
        opened?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!opened) {
        setError(describeMediaError(last));
        setLive(false);
        setGot({ video: false, audio: false });
        setBusy(false);
        return;
      }

      try {
        streamRef.current = opened;
        setStream(opened);
        const videoTracks = opened.getVideoTracks();
        const audioTracks = opened.getAudioTracks();
        setGot({ video: videoTracks.length > 0, audio: audioTracks.length > 0 });

        if (videoRef.current) {
          videoRef.current.srcObject = opened;
          await videoRef.current.play().catch(() => undefined);
        }
        videoTracks.forEach((t) => (t.enabled = camera));
        audioTracks.forEach((t) => (t.enabled = mic));
        if (audioTracks.length > 0) startMeter(opened);
        setLive(true);

        // Say which half we had to drop, so a working mic is never read as
        // "nothing works".
        if (videoTracks.length === 0) {
          setError('No camera available — your microphone is on.');
        } else if (audioTracks.length === 0) {
          setError('No microphone available — your camera is on.');
        }

        // Labels are blank until permission is granted, so enumerate after.
        const all = await navigator.mediaDevices.enumerateDevices();
        if (gen !== genRef.current) return;
        setCameras(all.filter((d) => d.kind === 'videoinput'));
        setMics(all.filter((d) => d.kind === 'audioinput'));
        setCameraId(videoTracks[0]?.getSettings().deviceId);
        setMicId(audioTracks[0]?.getSettings().deviceId);
      } finally {
        setBusy(false);
      }
    },
    [camera, mic, startMeter, stopMeter],
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

  // A guest's own camera goes in their seat, never over the host's frame; the
  // stage keeps showing whose room this is.
  const showVideo = ownsStage && live && got.video && camera;

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-nexus-800/60 via-ink-800 to-ink-900">
      {ownsStage && (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            showVideo ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            filter: filterCss(filter),
            transform: mirror ? 'scaleX(-1)' : undefined,
          }}
        />
      )}

      {/* Idle / camera-off / mic-only state */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-3xl">
            {live && got.audio && !got.video ? '🎙️' : live && !camera ? '🚫' : !ownsStage && live ? '🎬' : '🎥'}
          </div>
          <p className="text-sm font-semibold text-slate-200">
            {ownsStage && live && got.audio && !got.video
              ? 'Microphone only'
              : ownsStage && live && !camera
                ? 'Your camera is off'
                : hostName}
          </p>

          {!ownsStage && live && (
            <p className="max-w-xs text-xs text-slate-400">
              {!got.video
                ? 'Microphone only — your mic is live, and there is no camera to show in your seat.'
                : !camera
                  ? 'Your camera is off. Turn it back on to appear in your seat.'
                  : "You are on a seat — your camera shows in your seat below. This frame is the host's, and their video arrives with LiveKit."}
            </p>
          )}

          {!live && canBroadcast && !blocked && (
            <>
              <p className="max-w-xs text-xs text-slate-400">
                Turn your camera on to go on stage. Your browser will ask for camera and
                microphone permission. Nothing is published to viewers yet — video transport
                lands with LiveKit.
              </p>
              <button type="button" onClick={() => start()} disabled={busy} className="btn-live mt-1">
                {busy ? 'Starting…' : 'Start camera & mic'}
              </button>
            </>
          )}

          {!live && canBroadcast && blocked && (
            <p className="max-w-xs text-xs text-slate-400">{blocked}</p>
          )}

          {!live && !canBroadcast && (
            <p className="max-w-xs text-xs text-slate-500">
              Take a seat below to join the stage, or go live from the Live tab to use your own
              camera.
            </p>
          )}

          {/* Once live the control stack below carries the error; showing it
              here too says the same thing twice. */}
          {!live && error && (
            <p role="alert" className="max-w-xs text-xs font-medium text-live">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Everything that lives along the bottom is one stack: a fixed offset
          per layer collides with the header once the stage gets squeezed. */}
      {live && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {/* A dropped half is worth saying even once the preview is up. */}
          {error && (
            <p
              role="alert"
              className="mx-auto max-w-xs rounded-lg bg-black/70 px-3 py-1.5 text-center text-[11px] font-medium text-live"
            >
              {error}
            </p>
          )}

          {showFilters && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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

          <div className="flex flex-wrap items-center justify-center gap-2">
            <ControlButton
              active={camera && got.video}
              disabled={!got.video}
              onClick={toggleCamera}
              label={!got.video ? 'No camera' : camera ? 'Camera on' : 'Camera off'}
            >
              {camera && got.video ? '🎥' : '🚫'}
            </ControlButton>

            <div className="flex items-center gap-1.5">
              <ControlButton
                active={mic && got.audio}
                disabled={!got.audio}
                onClick={toggleMic}
                label={!got.audio ? 'No microphone' : mic ? 'Mic on' : 'Mic muted'}
              >
                {mic && got.audio ? '🎙️' : '🔇'}
              </ControlButton>
              {/* Live input level — the only honest proof the mic is capturing.
                  Decorative: it moves every animation frame, so announcing it
                  would be hostile. The mic button beside it carries the state a
                  screen reader needs. */}
              <div
                className="h-1.5 w-12 overflow-hidden rounded-full bg-white/15"
                aria-hidden="true"
              >
                <div
                  ref={meterRef}
                  className={`h-full w-full origin-left rounded-full ${
                    mic && got.audio ? 'bg-bean' : 'bg-white/20'
                  }`}
                  style={{ transform: 'scaleX(0)' }}
                />
              </div>
            </div>

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

            {cameras.length > 1 && (
              <DevicePicker
                devices={cameras}
                value={cameraId}
                label="Camera"
                fallbackName="Camera"
                onChange={(id) => {
                  setCameraId(id);
                  void start({ cameraId: id, micId });
                }}
              />
            )}
            {mics.length > 1 && (
              <DevicePicker
                devices={mics}
                value={micId}
                label="Microphone"
                fallbackName="Mic"
                onChange={(id) => {
                  setMicId(id);
                  void start({ cameraId, micId: id });
                }}
              />
            )}

            <button type="button" onClick={stop} className="btn-ghost px-3 py-1.5 text-xs">
              Stop
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function DevicePicker({
  devices,
  value,
  label,
  fallbackName,
  onChange,
}: {
  devices: MediaDeviceInfo[];
  value: string | undefined;
  label: string;
  fallbackName: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[9rem] rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white"
      aria-label={label}
    >
      {devices.map((d, i) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || `${fallbackName} ${i + 1}`}
        </option>
      ))}
    </select>
  );
}

function ControlButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full border text-base transition disabled:opacity-40 ${
        active
          ? 'border-white/20 bg-white/15 text-white'
          : 'border-live/40 bg-live/20 text-live'
      }`}
    >
      {children}
    </button>
  );
}
