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
  start(): Promise<void>;
  stop(): Promise<Blob | null>;
  cancel(): void;
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

export function useVoiceRecorder(): VoiceRecorder {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    typeof MediaRecorder === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
      ? 'unsupported'
      : 'idle',
  );
  const [error, setError] = useState<string | undefined>();
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

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
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async (): Promise<void> => {
    if (status === 'recording' || status === 'requesting-permission') return;
    if (status === 'unsupported') return;

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
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob =
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type })
          : null;
      cleanup();
      setStatus('idle');
      setDurationMs(0);
      if (resolve) resolve(blob);
    };
    recorder.onerror = (event) => {
      setStatus('error');
      const detail = (event as unknown as { error?: Error }).error;
      setError(detail?.message ?? 'Recorder error');
    };

    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    setDurationMs(0);

    intervalRef.current = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setDurationMs(Date.now() - startedAtRef.current);
      }
    }, 100);

    recorder.start();
    setStatus('recording');
  }, [status, cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return null;

    setStatus('stopping');
    return new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      chunksRef.current = [];
      recorder.stop();
    } else {
      cleanup();
      setStatus('idle');
      setDurationMs(0);
    }
  }, [cleanup]);

  return { status, error, durationMs, start, stop, cancel };
}
