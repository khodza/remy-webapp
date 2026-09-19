import { settingsButton } from '@telegram-apps/sdk-react';
import { useEffect, useRef } from 'react';

/**
 * Telegram's "Settings" item in the ⋯ menu. Registered once for the whole
 * app, so Settings needs no icon on every screen.
 */
export function useSettingsButton(onClick: () => void) {
  const handler = useRef(onClick);
  handler.current = onClick;
  useEffect(() => {
    if (!settingsButton.mount.isAvailable()) return undefined;
    settingsButton.mount();
    settingsButton.show();
    const off = settingsButton.onClick(() => handler.current());
    return () => {
      off();
      settingsButton.hide();
    };
  }, []);
}
