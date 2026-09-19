import { create } from 'zustand';

/**
 * What the page asked Telegram's MainButton to show. Outside Telegram (dev,
 * mock mode, screenshots) DevChrome renders the same button from this.
 */
export interface MainButtonState {
  visible: boolean;
  text: string;
  enabled: boolean;
  loading: boolean;
  variant: 'accent' | 'ok';
  onClick: (() => void) | null;
  /** Open sheets hide the page's button (a sheet has its own actions). */
  suppressed: number;
}

export const useMainButtonStore = create<MainButtonState>(() => ({
  visible: false,
  text: '',
  enabled: true,
  loading: false,
  variant: 'accent',
  onClick: null,
  suppressed: 0,
}));

export function suppressMainButton(): () => void {
  useMainButtonStore.setState((s) => ({ suppressed: s.suppressed + 1 }));
  return () => useMainButtonStore.setState((s) => ({ suppressed: Math.max(0, s.suppressed - 1) }));
}
