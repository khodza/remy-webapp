import { create } from 'zustand';
import type { AuthResult, User } from '@/shared/api/schemas';
import { exchangeInitDataForJwt } from '@/shared/api/auth';
import { ApiError } from '@/shared/api/client';

export type AuthFailure = 'session-expired' | 'forbidden' | 'no-init-data';

interface AuthState {
  token: string | null;
  expiresAt: Date | null;
  user: User | null;
  /** When an exchange is in flight, concurrent callers await this promise. */
  inFlight: Promise<AuthResult> | null;
  /** Last exchange failure the UI should explain (null when healthy). */
  failure: AuthFailure | null;
  authenticate(): Promise<string>;
  clear(): void;
  hydrate(result: AuthResult): void;
}

function classify(err: unknown): AuthFailure | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'NO_INIT_DATA') return 'no-init-data';
  if (err.status === 401) return 'session-expired';
  if (err.status === 403) return 'forbidden';
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  inFlight: null,
  failure: null,

  async authenticate(): Promise<string> {
    const { token, expiresAt, inFlight } = get();

    if (token && expiresAt && expiresAt.getTime() > Date.now() + 5_000) {
      return token;
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

  hydrate(result) {
    set({
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  },

  // Drops the credentials only. An exchange already in flight keeps going so
  // concurrent callers reuse it instead of each starting their own (F8).
  clear() {
    set({ token: null, expiresAt: null, user: null });
  },
}));
