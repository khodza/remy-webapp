import { Mic, MicOff, Square } from 'lucide-react';
import { useCallback, useEffect } from 'react';
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

export function VoiceRecordButton({ onCreated, onError }: VoiceRecordButtonProps) {
  const recorder = useVoiceRecorder();
  const create = useCreateTaskFromVoice();
  const haptic = useHapticFeedback();

  const disabled =
    recorder.status === 'unsupported' ||
    recorder.status === 'denied' ||
    create.isPending ||
    recorder.status === 'stopping' ||
    recorder.status === 'requesting-permission';

  const isRecording = recorder.status === 'recording';

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      haptic.impact('medium');
      const blob = await recorder.stop();
      if (!blob) return;
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
      return;
    }
    haptic.impact('light');
    await recorder.start();
  }, [isRecording, recorder, create, haptic, onCreated, onError]);

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

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={disabled && !isRecording}
        aria-label={isRecording ? 'Stop recording' : 'Start voice reminder'}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95 disabled:opacity-50 ${
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

      <div className="flex min-w-0 flex-col">
        <span className="font-sans text-[13px] font-medium text-[color:var(--color-text)]">
          {statusLabel(recorder.status, create.isPending)}
        </span>
        <span className="font-mono text-xs tabular-nums text-[color:var(--color-text-2)]">
          {isRecording
            ? formatDuration(recorder.durationMs)
            : create.isPending
              ? 'Transcribing…'
              : hint(recorder.status)}
        </span>
      </div>
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
      return 'Hold the mic to capture';
  }
}

function hint(
  status: ReturnType<typeof useVoiceRecorder>['status'],
): string {
  if (status === 'denied') {
    return 'Allow microphone in browser settings';
  }
  return 'Tap to start / stop';
}
