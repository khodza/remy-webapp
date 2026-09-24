import { create } from 'zustand';
import type { AuthResult, User } from '@/shared/api/schemas';
import { exchangeInitDataForJwt, refreshJwt } from '@/shared/api/auth';
import { ApiError } from '@/shared/api/client';

export type AuthFailure = 'session-expired' | 'forbidden' | 'no-init-data';

interface AuthState {
  token: string | null;
  /** When the token stops working (its `exp`, else the server's expiresAt). */
  expiresAt: Date | null;
  /** When the token was issued (its `iat`, else when it arrived). */
  issuedAt: Date | null;
  user: User | null;
  /** When an initData exchange is in flight, concurrent callers await this promise. */
  inFlight: Promise<AuthResult> | null;
  /** A refresh in flight; resolves null when it did not work (never rejects). */
  refreshing: Promise<AuthResult | null> | null;
  /** Last exchange failure the UI should explain (null when healthy). */
  failure: AuthFailure | null;
  /** A token that is still good for a moment, else a refreshed or re-exchanged one. */
  authenticate(): Promise<string>;
  /** POST /auth/refresh with the current token; null when there is none or the server said no. */
  refresh(): Promise<string | null>;
  /** After a 401 with `rejected`: a newer token if one arrived, else refresh once, else re-exchange. */
  recover(rejected: string): Promise<string>;
  clear(): void;
  hydrate(result: AuthResult): void;
}

/** Tokens older than this before expiry are not handed out (a request must have time to land). */
const EXPIRY_MARGIN_MS = 5_000;

function classify(err: unknown): AuthFailure | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'NO_INIT_DATA') return 'no-init-data';
  if (err.status === 401) return 'session-expired';
  if (err.status === 403) return 'forbidden';
  return null;
}

/** The `exp` / `iat` claims of a JWT, in ms; null when it is not a JWT (the mock token). */
export function decodeJwtTimes(token: string): { exp: Date | null; iat: Date | null } {
  const none = { exp: null, iat: null };
  const payload = token.split('.')[1];
  if (!payload) return none;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { exp?: unknown; iat?: unknown };
    const date = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
    return { exp: date(claims.exp), iat: date(claims.iat) };
  } catch {
    return none;
  }
}

function isUsable(token: string | null, expiresAt: Date | null, now = Date.now()): token is string {
  return token !== null && expiresAt !== null && expiresAt.getTime() > now + EXPIRY_MARGIN_MS;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  issuedAt: null,
  user: null,
  inFlight: null,
  refreshing: null,
  failure: null,

  async authenticate(): Promise<string> {
    const { token, expiresAt, inFlight, refreshing } = get();
    if (isUsable(token, expiresAt)) return token;

    // A refresh already on its way is the cheapest fresh token.
    if (refreshing) {
      const result = await refreshing;
      if (result) return result.token;
    }

    // Several requests can hit a 401 at once; they all share one exchange.
    if (inFlight) {
      const result = await inFlight;
      return result.token;
    }

    const promise = exchangeInitDataForJwt();
    set({ inFlight: promise });

    try {
      const result = await promise;
      get().hydrate(result);
      set({ failure: null });
      return result.token;
    } catch (err) {
      set({ failure: classify(err) });
      throw err;
    } finally {
      set({ inFlight: null });
    }
  },

  async refresh(): Promise<string | null> {
    const { token, refreshing } = get();
    if (refreshing) return (await refreshing)?.token ?? null;
    if (!token) return null;
    const promise = refreshJwt(token).then(
      (result) => {
        // Only adopt it if nothing newer arrived meanwhile.
        if (get().token === token) get().hydrate(result);
        return result;
      },
      () => null,
    );
    set({ refreshing: promise });
    try {
      return (await promise)?.token ?? null;
    } finally {
      set({ refreshing: null });
    }
  },

  async recover(rejected: string): Promise<string> {
    const { token, expiresAt } = get();
    if (token !== rejected && isUsable(token, expiresAt)) return token;
    if (token === rejected) {
      const refreshed = await get().refresh();
      if (refreshed) return refreshed;
      if (get().token === rejected) get().clear();
    }
    return get().authenticate();
  },

  hydrate(result) {
    const { exp, iat } = decodeJwtTimes(result.token);
    set({
      token: result.token,
      expiresAt: exp ?? result.expiresAt,
      issuedAt: iat ?? new Date(),
      user: result.user,
    });
  },

  // Drops the credentials only. An exchange already in flight keeps going so
  // concurrent callers reuse it instead of each starting their own (F8).
  clear() {
    set({ token: null, expiresAt: null, issuedAt: null, user: null });
  },
}));
