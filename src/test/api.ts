import { vi } from 'vitest';
import type { User } from '@/shared/api';
import { useAuthStore } from '@/shared/stores/auth.store';

export const TEST_USER: User = {
  id: 'user-1',
  telegramUserId: 123456789,
  firstName: 'Ada',
  lastName: null,
  username: 'ada',
  timezone: 'UTC',
};

/** Logged in without the initData exchange. */
export function signIn(user: Partial<User> = {}): void {
  useAuthStore.getState().hydrate({
    token: 'test-token',
    expiresAt: new Date(Date.now() + 3600_000),
    user: { ...TEST_USER, ...user },
  });
}

export interface FetchCall {
  method: string;
  path: string;
  body: unknown;
  signal: AbortSignal | undefined;
}

type Reply = ((call: FetchCall) => unknown) | object | string | number | boolean | null;

/**
 * Stubs global fetch with routes keyed "METHOD /path" (under /api/v1).
 * A route returns JSON, or a function of the call (return a promise to hold
 * the response, or a Response for an error status). A call whose signal
 * aborts rejects with an AbortError.
 */
export function mockApi(routes: Record<string, Reply>) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const call: FetchCall = {
      method,
      path,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init.signal ?? undefined,
    };
    calls.push(call);
    const reply = routes[`${method} ${path}`];
    if (reply === undefined)
      return new Response(JSON.stringify({ statusCode: 404, error: 'NOT_FOUND', message: path }), { status: 404 });
    const aborted = new Promise<never>((_, reject) => {
      call.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const value = await Promise.race([typeof reply === 'function' ? reply(call) : reply, aborted]);
    if (value instanceof Response) return value;
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** A promise you resolve later: holds a mocked response in flight. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
