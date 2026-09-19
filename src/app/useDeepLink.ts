import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** The task a bot button asked us to open, if any. */
function deepLinkedTaskId(): string | null {
  // "Open in app" on a reminder: <MINI_APP_URL>?task=<id>
  const fromQuery = new URLSearchParams(window.location.search).get('task');
  if (fromQuery && OBJECT_ID.test(fromQuery)) return fromQuery;

  // t.me/<bot>/<app>?startapp=task_<id>
  try {
    const startParam = retrieveLaunchParams().tgWebAppStartParam;
    const match = typeof startParam === 'string' ? /^task_([0-9a-f]{24})$/i.exec(startParam) : null;
    if (match?.[1]) return match[1];
  } catch {
    // Outside Telegram there are no launch params.
  }
  return null;
}

/** Opens the deep-linked task once, on startup. Mount inside the Router. */
export function useDeepLink(): void {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const taskId = deepLinkedTaskId();
    if (taskId) navigate(`/tasks/${taskId}`, { replace: true });
  }, [navigate]);
}
