import { AppRoot, Placeholder } from '@telegram-apps/telegram-ui';
import {
  isColorDark,
  isRGB,
  retrieveLaunchParams,
} from '@telegram-apps/sdk-react';
import { useMemo } from 'react';

export function EnvUnsupported() {
  const [platform, isDark] = useMemo(() => {
    try {
      const lp = retrieveLaunchParams();
      const bgColor = lp.tgWebAppThemeParams?.bg_color;
      return [
        lp.tgWebAppPlatform,
        bgColor && isRGB(bgColor) ? isColorDark(bgColor) : false,
      ] as const;
    } catch {
      return ['android', false] as const;
    }
  }, []);

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(platform) ? 'ios' : 'base'}
    >
      <Placeholder
        header="Open in Telegram"
        description="Remy runs inside Telegram. Open it from the Remy bot to continue."
      />
    </AppRoot>
  );
}
