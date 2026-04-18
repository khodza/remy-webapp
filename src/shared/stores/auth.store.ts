import { create } from 'zustand';
import type { AuthResult, User } from '@/shared/api/schemas';
import { exchangeInitDataForJwt } from '@/shared/api/auth';

interface AuthState {
  token: string | null;
  expiresAt: Date | null;
  user: User | null;
  /** When an exchange is in flight, concurrent callers await this promise. */
  inFlight: Promise<AuthResult> | null;
  authenticate(): Promise<string>;
  clear(): void;
  hydrate(result: AuthResult): void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  inFlight: null,

  async authenticate(): Promise<string> {
    const { token, expiresAt, inFlight } = get();

    if (token && expiresAt && expiresAt.getTime() > Date.now() + 5_000) {
      return token;
    }

    if (inFlight) {
      const result = await inFlight;
      return result.token;
    }

    const promise = exchangeInitDataForJwt();
    set({ inFlight: promise });

    try {
      const result = await promise;
      get().hydrate(result);
      return result.token;
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

  clear() {
    set({ token: null, expiresAt: null, user: null, inFlight: null });
  },
}));
