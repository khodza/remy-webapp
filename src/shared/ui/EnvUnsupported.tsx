import { AppRoot, Placeholder } from '@telegram-apps/telegram-ui';
import {
  isColorDark,
  isRGB,
  retrieveLaunchParams,
} from '@telegram-apps/sdk-react';
import { useMemo } from 'react';

interface EnvUnsupportedProps {
  error?: string;
}

export function EnvUnsupported({ error }: EnvUnsupportedProps) {
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

  const showError = Boolean(error) && import.meta.env.DEV;

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(platform) ? 'ios' : 'base'}
    >
      <Placeholder
        header="Open in Telegram"
        description="Remy runs inside Telegram. Open it from the Remy bot to continue."
      />
      {showError && (
        <pre
          style={{
            padding: '12px 16px',
            margin: '8px 16px',
            background: 'rgba(255, 80, 80, 0.08)',
            color: '#c23',
            borderRadius: 12,
            fontSize: 11,
            fontFamily: 'ui-monospace, Menlo, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error}
        </pre>
      )}
    </AppRoot>
  );
}
