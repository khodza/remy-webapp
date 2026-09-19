import { mainButton } from '@telegram-apps/sdk-react';
import { useEffect, useRef } from 'react';
import { useMainButtonStore } from './mainButtonStore';

export interface MainButtonOptions {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  loading?: boolean;
  visible?: boolean;
  /** 'ok' paints it green (Mark as done). */
  variant?: 'accent' | 'ok';
}

/** Resolved token colours, so Telegram's native button matches the page. */
function tokenColor(name: string): `#${string}` | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? (value as `#${string}`) : undefined;
}

export function useMainButton({
  text,
  onClick,
  enabled = true,
  loading = false,
  visible = true,
  variant = 'accent',
}: MainButtonOptions) {
  // The handler lives in a ref so an inline closure does not re-register
  // the button on every render.
  const handler = useRef(onClick);
  handler.current = onClick;
  const suppressed = useMainButtonStore((s) => s.suppressed > 0);
  const shown = visible && !suppressed;

  useEffect(() => {
    const click = () => handler.current();
    useMainButtonStore.setState({ visible: shown, text, enabled, loading, variant, onClick: click });

    let off: (() => void) | undefined;
    if (mainButton.mount.isAvailable()) {
      mainButton.mount();
      const background = tokenColor(variant === 'ok' ? '--color-ok' : '--color-accent');
      const foreground = tokenColor(variant === 'ok' ? '--color-surface' : '--color-accent-fg');
      mainButton.setParams({
        text,
        isEnabled: enabled,
        isLoaderVisible: loading,
        isVisible: shown,
        ...(background ? { backgroundColor: background } : {}),
        ...(foreground ? { textColor: foreground } : {}),
      });
      off = mainButton.onClick(click);
    }
    return () => {
      off?.();
      if (mainButton.isMounted()) mainButton.setParams({ isVisible: false });
      useMainButtonStore.setState({ visible: false, onClick: null });
    };
  }, [text, enabled, loading, shown, variant]);
}
