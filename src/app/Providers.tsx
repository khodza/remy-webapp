import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
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
