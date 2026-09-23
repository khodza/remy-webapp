import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_DURATION_MS } from '@/shared/lib/useVoiceRecorder';
import { installFakeMic } from '@/test/fakeMediaRecorder';
import { renderWithProviders } from '@/test/render';
import { VoiceRecordButton } from './VoiceRecordButton';

const createTaskFromVoice = vi.fn();
vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  createTaskFromVoice: (blob: Blob) => createTaskFromVoice(blob),
}));

describe('VoiceRecordButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createTaskFromVoice.mockReset().mockResolvedValue({ id: 'task-1' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uploads a note that runs into the 90 s cap, like a tap-to-stop', async () => {
    installFakeMic();
    const onCreated = vi.fn();
    renderWithProviders(<VoiceRecordButton onCreated={onCreated} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start voice reminder' }));
    });
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_DURATION_MS + 200);
    });

    expect(createTaskFromVoice).toHaveBeenCalledTimes(1);
    expect(createTaskFromVoice.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('uploads on tap-to-stop', async () => {
    installFakeMic();
    renderWithProviders(<VoiceRecordButton onCreated={() => undefined} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start voice reminder' }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(createTaskFromVoice).toHaveBeenCalledTimes(1);
  });
});
