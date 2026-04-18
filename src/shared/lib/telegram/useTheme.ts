import { miniApp, useSignal } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme(): Theme {
  const isDark = useSignal(miniApp.isDark);
  const theme: Theme = isDark ? 'dark' : 'light';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return theme;
}
