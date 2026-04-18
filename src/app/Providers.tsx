import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoot } from '@telegram-apps/telegram-ui';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import {
  retrieveLaunchParams,
} from '@telegram-apps/sdk-react';
import { useTheme } from '@/shared/lib/telegram';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
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
        {children}
      </AppRoot>
    </QueryClientProvider>
  );
}
