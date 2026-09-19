import { useState } from 'react';
import { useSettings, useUpdateSettings } from '@/features/settings';
import type { DefaultView } from '@/shared/api';

const KEY = 'remy.todayView';

function readLocal(): DefaultView | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'timeline' || value === 'list' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Timeline or List. Settings hold the choice (it follows you across
 * devices); the phone keeps a copy so the app opens in it without a flash.
 */
export function useTodayView(): [DefaultView, (view: DefaultView) => void] {
  const settings = useSettings();
  const update = useUpdateSettings();
  const [local, setLocal] = useState<DefaultView | null>(readLocal);
  const view = local ?? settings.data?.defaultView ?? 'timeline';

  const setView = (next: DefaultView) => {
    setLocal(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // private mode: the setting below still persists it
    }
    if (settings.data?.defaultView !== next) update.mutate({ defaultView: next });
  };
  return [view, setView];
}
