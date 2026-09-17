import { Mic, MicOff, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCreateTaskFromVoice } from '../hooks';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { useVoiceRecorder } from '@/shared/lib/useVoiceRecorder';

interface VoiceRecordButtonProps {
  onCreated: () => void;
  onError?: (message: string) => void;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Show "Xs left" once the cap is within reach so the cut-off is no surprise. */
const COUNTDOWN_FROM_MS = 60_000;

export function VoiceRecordButton({ onCreated, onError }: VoiceRecordButtonProps) {
  const recorder = useVoiceRecorder();
  const create = useCreateTaskFromVoice();
  const haptic = useHapticFeedback();
  const [notice, setNotice] = useState<string | null>(null);
  // Auto-stop at the cap resolves a stop() nobody awaited; capture it here.
  const autoStopRef = useRef(false);

  const isRecording = recorder.status === 'recording';
  const disabled =
    recorder.status === 'unsupported' ||
    create.isPending ||
    recorder.status === 'stopping' ||
    recorder.status === 'requesting-permission';

  const upload = useCallback(
    (blob: Blob | null) => {
      if (!blob || blob.size === 0) {
        setNotice('Nothing was recorded, try again.');
        return;
      }
      setNotice(null);
      create.mutate(blob, {
        onSuccess: () => {
          haptic.notify('success');
          onCreated();
        },
        onError: (err) => {
          haptic.notify('error');
          onError?.(err instanceof Error ? err.message : 'Upload failed');
        },
      });
    },
    [create, haptic, onCreated, onError],
  );

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      haptic.impact('medium');
      upload(await recorder.stop());
      return;
    }
    setNotice(null);
    haptic.impact('light');
    await recorder.start();
  }, [isRecording, recorder, haptic, upload]);

  // When the 90 s cap fires, the hook stops on its own; treat it like a tap.
  useEffect(() => {
    if (
      isRecording &&
      recorder.durationMs >= recorder.maxDurationMs &&
      !autoStopRef.current
    ) {
      autoStopRef.current = true;
      void recorder.stop().then((blob) => {
        autoStopRef.current = false;
        upload(blob);
      });
    }
  }, [isRecording, recorder, upload]);

  useEffect(() => {
    if (recorder.error) {
      onError?.(recorder.error);
    }
  }, [recorder.error, onError]);

  if (recorder.status === 'unsupported') {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-3 py-2 text-[color:var(--color-text-2)]">
        <MicOff size={16} />
        <span className="font-sans text-xs">
          Voice recording isn't supported on this device.
        </span>
      </div>
    );
  }

  const remainingMs = recorder.maxDurationMs - recorder.durationMs;
  const showCountdown = isRecording && recorder.durationMs >= COUNTDOWN_FROM_MS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={disabled && !isRecording}
          aria-label={isRecording ? 'Stop recording' : 'Start voice reminder'}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95 disabled:opacity-50 ${
            isRecording
              ? 'bg-[color:var(--color-danger)] text-white'
              : 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]'
          }`}
        >
          {isRecording ? (
            <Square size={18} fill="currentColor" />
          ) : (
            <Mic size={20} />
          )}
          {isRecording && (
            <span className="pointer-events-none absolute h-12 w-12 animate-ping rounded-full bg-[color:var(--color-danger)] opacity-40" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-sans text-[13px] font-medium text-[color:var(--color-text)]">
            {statusLabel(recorder.status, create.isPending)}
          </span>
          <span className="font-mono text-xs tabular-nums text-[color:var(--color-text-2)]">
            {isRecording
              ? showCountdown
                ? `${formatDuration(recorder.durationMs)} · ${Math.ceil(remainingMs / 1000)}s left`
                : formatDuration(recorder.durationMs)
              : create.isPending
                ? 'Transcribing…'
                : hint(recorder.status)}
          </span>
        </div>

        {isRecording && (
          <button
            type="button"
            onClick={() => {
              haptic.impact('light');
              recorder.cancel();
              setNotice(null);
            }}
            aria-label="Cancel recording"
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 font-sans text-xs text-[color:var(--color-text-2)] transition hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
          >
            <X size={14} />
            Cancel
          </button>
        )}
      </div>

      {notice && (
        <p className="font-sans text-xs text-[color:var(--color-text-2)]">
          {notice}
        </p>
      )}
    </div>
  );
}

function statusLabel(
  status: ReturnType<typeof useVoiceRecorder>['status'],
  uploading: boolean,
): string {
  if (uploading) return 'Creating reminder';
  switch (status) {
    case 'recording':
      return 'Recording';
    case 'requesting-permission':
      return 'Waiting for mic access…';
    case 'stopping':
      return 'Finishing up';
    case 'denied':
      return 'Mic access denied';
    case 'error':
      return 'Something went wrong';
    default:
      return 'Tap the mic to capture';
  }
}

function hint(
  status: ReturnType<typeof useVoiceRecorder>['status'],
): string {
  if (status === 'denied') {
    return 'Allow the microphone in Telegram / browser settings, then tap again';
  }
  if (status === 'error') {
    return 'Tap to try again';
  }
  return 'Tap to start / stop · up to 1:30';
}
