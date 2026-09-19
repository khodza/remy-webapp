import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pushBack } from './backStack';

/** History index React Router keeps in history.state (0 = first entry). */
function historyIndex(): number {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}

/**
 * Shows Telegram's Back button for a page. It goes back in history, or to
 * Today when the page was opened directly (a deep link from the bot).
 */
export function useBackButton(show = true) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!show) return undefined;
    return pushBack(() => {
      if (historyIndex() > 0) navigate(-1);
      else navigate('/', { replace: true });
    });
  }, [show, navigate]);
}

/** Back closes something (a sheet) while `active`. The latest handler wins. */
export function useBackHandler(active: boolean, onBack: () => void) {
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!active) return undefined;
    return pushBack(() => handler.current());
  }, [active]);
}
