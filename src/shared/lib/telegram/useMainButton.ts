import { mainButton } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export interface MainButtonOptions {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  loading?: boolean;
  visible?: boolean;
}

export function useMainButton({
  text,
  onClick,
  enabled = true,
  loading = false,
  visible = true,
}: MainButtonOptions) {
  useEffect(() => {
    if (!mainButton.mount.isAvailable()) return undefined;

    mainButton.mount();
    mainButton.setParams({
      text,
      isEnabled: enabled,
      isLoaderVisible: loading,
      isVisible: visible,
    });

    const off = mainButton.onClick(onClick);
    return () => {
      off();
      mainButton.setParams({ isVisible: false });
    };
  }, [text, onClick, enabled, loading, visible]);
}
