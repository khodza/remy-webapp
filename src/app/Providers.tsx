import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoot } from '@telegram-apps/telegram-ui';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { ApiError } from '@/shared/api';
import { useTheme } from '@/shared/lib/telegram';
import { AuthGate } from '@/shared/ui';

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
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function Providers({ children }: PropsWithChildren) {
  const theme = useTheme();
  const platform = useMemo(() => {
    try {
      return retrieveLaunchParams().tgWebAppPlatform;
    } catch {
      return 'tdesktop';
    }
  }, []);
  const tgPlatform: 'ios' | 'base' =
    platform === 'ios' || platform === 'macos' ? 'ios' : 'base';

  return (
    <QueryClientProvider client={queryClient}>
      <AppRoot appearance={theme} platform={tgPlatform}>
        <AuthGate>{children}</AuthGate>
      </AppRoot>
    </QueryClientProvider>
  );
}
