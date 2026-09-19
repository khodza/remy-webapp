import { miniApp, useSignal } from '@telegram-apps/sdk-react';
import { useLayoutEffect } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Follows Telegram's light/dark scheme and paints Telegram's own header and
 * background with the page colour, so the app does not sit in a differently
 * coloured frame.
 */
export function useTheme(): Theme {
  const isDark = useSignal(miniApp.isDark);
  const theme: Theme = isDark ? 'dark' : 'light';

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (/^#[0-9a-f]{6}$/i.test(bg)) {
      const color = bg as `#${string}`;
      miniApp.setHeaderColor.ifAvailable(color);
      miniApp.setBackgroundColor.ifAvailable(color);
      miniApp.setBottomBarColor.ifAvailable(color);
    }
  }, [theme]);

  return theme;
}
