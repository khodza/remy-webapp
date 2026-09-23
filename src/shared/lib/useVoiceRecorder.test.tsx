import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeMic } from '@/test/fakeMediaRecorder';
import { MAX_DURATION_MS, useVoiceRecorder } from './useVoiceRecorder';

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hands the blob back from a tap-to-stop', async () => {
    const { stopTrack } = installFakeMic();
    const { result } = renderHook(() => useVoiceRecorder());
    await act(() => result.current.start());
    expect(result.current.status).toBe('recording');

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(result.current.status).toBe('idle');
    expect(stopTrack).toHaveBeenCalled();
  });

  it('keeps a note that reaches the cap and passes it to onAutoStop', async () => {
    const { stopTrack } = installFakeMic();
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useVoiceRecorder({ onAutoStop }));
    await act(() => result.current.start());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_DURATION_MS - 1000);
    });
    expect(result.current.status).toBe('recording');
    expect(onAutoStop).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    const blob = onAutoStop.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(result.current.status).toBe('idle');
    // The mic is released as after a tap.
    expect(stopTrack).toHaveBeenCalled();
  });

  it('does not call onAutoStop for a cancelled recording', async () => {
    installFakeMic();
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useVoiceRecorder({ onAutoStop }));
    await act(() => result.current.start());
    await act(async () => {
      result.current.cancel();
      await vi.advanceTimersByTimeAsync(MAX_DURATION_MS + 1000);
    });
    expect(onAutoStop).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});
