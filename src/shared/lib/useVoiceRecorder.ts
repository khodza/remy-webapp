import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'stopping'
  | 'unsupported'
  | 'denied'
  | 'error';

export interface VoiceRecorder {
  status: RecorderStatus;
  error?: string;
  durationMs: number;
  /** Hard cap; recording stops itself when reached. */
  maxDurationMs: number;
  start(): Promise<void>;
  stop(): Promise<Blob | null>;
  /** Discard the current recording without producing a blob. */
  cancel(): void;
}

export const MAX_DURATION_MS = 90_000;

export interface VoiceRecorderOptions {
  /**
   * The recording hit the cap and stopped itself. Receives the blob exactly
   * as a tap-to-stop `stop()` would (null when nothing was captured).
   */
  onAutoStop?: (blob: Blob | null) => void;
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecorder(options: VoiceRecorderOptions = {}): VoiceRecorder {
  const [status, setStatusRaw] = useState<RecorderStatus>(() =>
    typeof MediaRecorder === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
      ? 'unsupported'
      : 'idle',
  );
  const [error, setErrorRaw] = useState<string | undefined>();
  const [durationMs, setDurationRaw] = useState(0);

  const mountedRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const discardRef = useRef(false);
  // Latest callback without restarting anything when the caller re-renders.
  const onAutoStopRef = useRef(options.onAutoStop);
  onAutoStopRef.current = options.onAutoStop;

  // MediaRecorder callbacks can fire after the component is gone; guard
  // every state write so React does not warn and nothing leaks.
  const setStatus = useCallback((s: RecorderStatus) => {
    if (mountedRef.current) setStatusRaw(s);
  }, []);
  const setError = useCallback((e: string | undefined) => {
    if (mountedRef.current) setErrorRaw(e);
  }, []);
  const setDurationMs = useCallback((d: number) => {
    if (mountedRef.current) setDurationRaw(d);
  }, []);

  /** Release the mic and timers. Safe to call more than once. */
  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    stopResolverRef.current = null;
    discardRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        // Leaving the screen mid-recording: stop the recorder (its onstop
        // will release the stream) and drop whatever was captured.
        discardRef.current = true;
        try {
          recorder.stop();
        } catch {
          cleanup();
        }
      } else {
        cleanup();
      }
    };
  }, [cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return null;

    setStatus('stopping');
    return new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, [setStatus]);

  const start = useCallback(async (): Promise<void> => {
    if (status === 'recording' || status === 'requesting-permission') return;
    if (status === 'unsupported') return;
    // 'denied' is not terminal: the user may have granted access since, so
    // simply ask again.

    setError(undefined);
    setStatus('requesting-permission');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setStatus('denied');
      } else {
        setStatus('error');
      }
      setError(err instanceof Error ? err.message : 'Microphone unavailable');
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = pickSupportedMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop());
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Recorder init failed');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const resolve = stopResolverRef.current;
      const discarded = discardRef.current;
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob =
        !discarded && chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type })
          : null;
      cleanup();
      setStatus('idle');
      setDurationMs(0);
      if (resolve) resolve(blob);
    };
    recorder.onerror = (event) => {
      const detail = (event as unknown as { error?: Error }).error;
      const resolve = stopResolverRef.current;
      // Release the mic (F6): without this the hardware indicator stays on.
      cleanup();
      setStatus('error');
      setError(detail?.message ?? 'Recorder error');
      setDurationMs(0);
      if (resolve) resolve(null);
    };

    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    setDurationMs(0);

    intervalRef.current = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(elapsed);
      if (elapsed >= MAX_DURATION_MS && recorder.state === 'recording') {
        // Auto-stop at the cap. Nobody is awaiting stop() here, so onstop
        // hands the blob to onAutoStop: the note is kept and uploaded like
        // a tap-to-stop, not dropped.
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDurationMs(MAX_DURATION_MS);
        setStatus('stopping');
        stopResolverRef.current ??= (blob) => onAutoStopRef.current?.(blob);
        recorder.stop();
      }
    }, 100);

    recorder.start();
    setStatus('recording');
  }, [status, cleanup, setStatus, setError, setDurationMs]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      discardRef.current = true;
      recorder.stop();
    } else {
      cleanup();
      setStatus('idle');
      setDurationMs(0);
    }
  }, [cleanup, setStatus, setDurationMs]);

  return {
    status,
    error,
    durationMs,
    maxDurationMs: MAX_DURATION_MS,
    start,
    stop,
    cancel,
  };
}
