import { useEffect } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';

/** Refresh when this share of the token's lifetime has passed. */
export const REFRESH_AT = 0.8;
/** A refresh that failed (network) is tried again after this, while the token still lives. */
export const RETRY_MS = 60_000;

/** Milliseconds from `now` until the token should be refreshed (0 = now). */
export function refreshDelayMs(issuedAt: Date, expiresAt: Date, now: Date): number {
  const lifetime = Math.max(0, expiresAt.getTime() - issuedAt.getTime());
  return Math.max(0, issuedAt.getTime() + lifetime * REFRESH_AT - now.getTime());
}

/**
 * Keeps the 15-minute JWT alive while the app is open: POST /auth/refresh
 * at 80 % of its lifetime, only while the page is visible (a hidden webview
 * refreshes the moment it comes back, if the token is still valid; an
 * expired one is re-exchanged by the next request). The token never leaves
 * memory. Mounted once (app/Root).
 */
export function useTokenRefresh(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const schedule = () => {
      clearTimeout(timer);
      if (disposed || document.visibilityState !== 'visible') return;
      const { token, issuedAt, expiresAt } = useAuthStore.getState();
      if (!token || !issuedAt || !expiresAt) return;
      const now = new Date();
      // Too late to refresh: the next request re-exchanges initData.
      if (expiresAt.getTime() <= now.getTime()) return;
      timer = setTimeout(
        () => {
          void useAuthStore
            .getState()
            .refresh()
            .then((fresh) => {
              // A new token reschedules itself through the subscription; a
              // failed attempt is retried while there is still time.
              if (fresh === null && !disposed && useAuthStore.getState().token === token) {
                clearTimeout(timer);
                const left = useAuthStore.getState().expiresAt?.getTime() ?? 0;
                if (left - Date.now() > RETRY_MS && document.visibilityState === 'visible') {
                  timer = setTimeout(schedule, RETRY_MS);
                }
              }
            });
        },
        refreshDelayMs(issuedAt, expiresAt, now),
      );
    };

    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.token !== previous.token) schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, []);
}
