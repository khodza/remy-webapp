import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, TEST_USER } from '@/test/api';
import { decodeJwtTimes, useAuthStore } from './auth.store';

vi.mock('@/shared/lib/telegram', () => ({ readRawInitData: () => 'user=%7B%22id%22%3A1%7D&hash=dev-mock-hash' }));

/** An unsigned JWT with the given claims (the store only reads them). */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;
}

const NOW = new Date('2026-09-23T08:00:00Z');
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);
const result = (token: string, expiresAt: Date) => ({ token, expiresAt: expiresAt.toISOString(), user: TEST_USER });

describe('auth store', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    useAuthStore.setState({
      token: null,
      expiresAt: null,
      issuedAt: null,
      user: null,
      inFlight: null,
      refreshing: null,
      failure: null,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reads exp and iat from the token, falling back to the server expiresAt', () => {
    const exp = new Date(NOW.getTime() + 15 * 60_000);
    expect(decodeJwtTimes(jwt({ exp: seconds(exp), iat: seconds(NOW) }))).toEqual({ exp, iat: NOW });
    expect(decodeJwtTimes('mock-jwt-token')).toEqual({ exp: null, iat: null });

    useAuthStore.getState().hydrate({ token: jwt({ exp: seconds(exp) }), expiresAt: new Date(0), user: TEST_USER });
    expect(useAuthStore.getState().expiresAt).toEqual(exp);
    expect(useAuthStore.getState().issuedAt).toEqual(NOW);

    const serverSays = new Date(NOW.getTime() + 60_000);
    useAuthStore.getState().hydrate({ token: 'mock-jwt-token', expiresAt: serverSays, user: TEST_USER });
    expect(useAuthStore.getState().expiresAt).toEqual(serverSays);
  });

  it('hands out a token that still has more than five seconds to live, without a request', async () => {
    const { calls } = mockApi({});
    useAuthStore.getState().hydrate({ token: 'live', expiresAt: new Date(NOW.getTime() + 60_000), user: TEST_USER });
    expect(await useAuthStore.getState().authenticate()).toBe('live');
    expect(calls).toHaveLength(0);
  });

  it('refreshes through POST /auth/refresh with the current token, once for concurrent callers', async () => {
    const later = new Date(NOW.getTime() + 15 * 60_000);
    const { calls, fetchMock } = mockApi({ 'POST /auth/refresh': result('fresh', later) });
    useAuthStore.getState().hydrate({ token: 'old', expiresAt: new Date(NOW.getTime() + 60_000), user: TEST_USER });

    const [a, b] = await Promise.all([useAuthStore.getState().refresh(), useAuthStore.getState().refresh()]);
    expect(a).toBe('fresh');
    expect(b).toBe('fresh');
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer old');
    expect(useAuthStore.getState().token).toBe('fresh');
    expect(useAuthStore.getState().expiresAt).toEqual(later);
  });

  it('recovers from a 401 by refreshing first, and re-exchanges initData only when that fails', async () => {
    const later = new Date(NOW.getTime() + 15 * 60_000);
    const { calls } = mockApi({
      'POST /auth/refresh': () =>
        new Response(JSON.stringify({ statusCode: 401, error: 'UNAUTHORIZED', message: 'expired' }), { status: 401 }),
      'POST /auth/telegram': result('exchanged', later),
    });
    useAuthStore.getState().hydrate({ token: 'rejected', expiresAt: later, user: TEST_USER });

    expect(await useAuthStore.getState().recover('rejected')).toBe('exchanged');
    expect(calls.map((c) => c.path)).toEqual(['/auth/refresh', '/auth/telegram']);
    expect(useAuthStore.getState().failure).toBeNull();
  });

  it('recovers with the refreshed token when the refresh works', async () => {
    const later = new Date(NOW.getTime() + 15 * 60_000);
    const { calls } = mockApi({ 'POST /auth/refresh': result('fresh', later) });
    useAuthStore.getState().hydrate({ token: 'rejected', expiresAt: later, user: TEST_USER });
    expect(await useAuthStore.getState().recover('rejected')).toBe('fresh');
    expect(calls.map((c) => c.path)).toEqual(['/auth/refresh']);
  });

  it('reuses a token another request already replaced instead of refreshing again', async () => {
    const { calls } = mockApi({});
    useAuthStore.getState().hydrate({ token: 'newer', expiresAt: new Date(NOW.getTime() + 60_000), user: TEST_USER });
    expect(await useAuthStore.getState().recover('older')).toBe('newer');
    expect(calls).toHaveLength(0);
  });
});
