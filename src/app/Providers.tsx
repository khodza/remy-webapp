import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { miniApp } from '@telegram-apps/sdk-react';
import type { PropsWithChildren } from 'react';
import { ApiError } from '@/shared/api';
import { useTheme } from '@/shared/lib/telegram';
import { AuthGate, DevChrome, Toaster } from '@/shared/ui';

// Client errors (bad request, auth, not found) won't fix themselves on
// retry; everything else gets one more attempt.
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) =>
        !(err instanceof ApiError && NO_RETRY_STATUSES.has(err.status)) &&
        count < 1,
      // Coming back to the app (tab, webview or Telegram re-activating
      // it) refetches whatever is stale, so lists are never old news.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// "Focus" is the page becoming visible or focused, or Telegram activating
// the Mini App again (Bot API 8 `activated`). Only visibility can report
// unfocused: a paused retry must not hinge on the Telegram signal.
focusManager.setEventListener((handleFocus) => {
  const onVisibility = () => handleFocus(document.visibilityState === 'visible');
  const onFocus = () => handleFocus(true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  let offActive: (() => void) | undefined;
  try {
    offActive = miniApp.isActive.sub((active) => {
      if (active) handleFocus(true);
    });
  } catch {
    // older SDK state: visibility alone still works
  }
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    offActive?.();
  };
});

export function Providers({ children }: PropsWithChildren) {
  useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <DevChrome>
        <AuthGate>{children}</AuthGate>
      </DevChrome>
      <Toaster />
    </QueryClientProvider>
  );
}
