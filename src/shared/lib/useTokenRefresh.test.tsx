import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/shared/stores/auth.store';
import { mockApi, TEST_USER } from '@/test/api';
import { refreshDelayMs, useTokenRefresh } from './useTokenRefresh';

const NOW = new Date('2026-09-23T08:00:00Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('refreshDelayMs', () => {
  it('is 80 % of the lifetime from issue, never negative', () => {
    expect(refreshDelayMs(NOW, minutes(15), NOW)).toBe(12 * 60_000);
    expect(refreshDelayMs(NOW, minutes(15), minutes(5))).toBe(7 * 60_000);
    expect(refreshDelayMs(NOW, minutes(15), minutes(14))).toBe(0);
  });
});

describe('useTokenRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    setVisibility('visible');
    useAuthStore.setState({ token: null, expiresAt: null, issuedAt: null, user: null, refreshing: null });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('refreshes at 80 % of the lifetime while visible, and again for the next token', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': () => ({
        token: `t${calls.length}`,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        user: TEST_USER,
      }),
    });
    renderHook(() => useTokenRefresh());
    useAuthStore.getState().hydrate({ token: 't0', expiresAt: minutes(15), user: TEST_USER });

    await advance(12 * 60_000 - 1000);
    expect(calls).toHaveLength(0);
    await advance(1000);
    expect(calls.map((c) => c.path)).toEqual(['/auth/refresh']);
    expect(useAuthStore.getState().token).toBe('t1');

    // The refreshed token (15 min from then) is refreshed in its turn.
    await advance(12 * 60_000);
    expect(calls).toHaveLength(2);
  });

  it('waits while the app is hidden and refreshes when it is visible again', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': { token: 'fresh', expiresAt: minutes(29).toISOString(), user: TEST_USER },
    });
    renderHook(() => useTokenRefresh());
    useAuthStore.getState().hydrate({ token: 't0', expiresAt: minutes(15), user: TEST_USER });
    setVisibility('hidden');

    await advance(13 * 60_000);
    expect(calls).toHaveLength(0);

    setVisibility('visible');
    await advance(10);
    expect(calls.map((c) => c.path)).toEqual(['/auth/refresh']);
  });

  it('does not refresh a token that already expired (the next request re-exchanges)', async () => {
    const { calls } = mockApi({});
    renderHook(() => useTokenRefresh());
    useAuthStore.getState().hydrate({ token: 't0', expiresAt: minutes(15), user: TEST_USER });
    setVisibility('hidden');
    await advance(16 * 60_000);
    setVisibility('visible');
    await advance(10);
    expect(calls).toHaveLength(0);
  });

  it('tries again a minute later when the refresh failed but the token still lives', async () => {
    let failures = 0;
    const { calls } = mockApi({
      'POST /auth/refresh': () => {
        if (failures < 1) {
          failures += 1;
          return new Response(JSON.stringify({ statusCode: 503, error: 'DOWN', message: 'down' }), { status: 503 });
        }
        return { token: 'fresh', expiresAt: minutes(30).toISOString(), user: TEST_USER };
      },
    });
    renderHook(() => useTokenRefresh());
    useAuthStore.getState().hydrate({ token: 't0', expiresAt: minutes(15), user: TEST_USER });
    await advance(12 * 60_000 + 10);
    expect(calls).toHaveLength(1);
    expect(useAuthStore.getState().token).toBe('t0');
    await advance(60_000 + 10);
    expect(calls).toHaveLength(2);
    expect(useAuthStore.getState().token).toBe('fresh');
  });
});
