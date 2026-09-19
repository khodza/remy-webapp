import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Screens a bot button may open by name (`?screen=<name>` or `startapp=<name>`). */
const SCREENS: Record<string, string> = {
  settings: '/settings',
  catchup: '/catchup',
  week: '/week',
};

function startParam(): string | null {
  try {
    const value = retrieveLaunchParams().tgWebAppStartParam;
    return typeof value === 'string' ? value : null;
  } catch {
    // Outside Telegram there are no launch params.
    return null;
  }
}

/** Where a bot button asked us to go, if anywhere. */
export function deepLinkTarget(
  search: string = window.location.search,
  start: string | null = startParam(),
): string | null {
  const query = new URLSearchParams(search);

  // "Open in app" on a reminder: <MINI_APP_URL>?task=<id>
  const task = query.get('task');
  if (task && OBJECT_ID.test(task)) return `/tasks/${task}`;

  // /settings in the bot: <MINI_APP_URL>?screen=settings
  const screen = query.get('screen');
  if (screen && SCREENS[screen]) return SCREENS[screen];

  // t.me/<bot>/<app>?startapp=task_<id> | settings
  if (start) {
    const match = /^task_([0-9a-f]{24})$/i.exec(start);
    if (match?.[1]) return `/tasks/${match[1]}`;
    if (SCREENS[start]) return SCREENS[start];
  }
  return null;
}

/** Opens the deep-linked screen once, on startup. Mount inside the Router. */
export function useDeepLink(): void {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const target = deepLinkTarget();
    if (target) navigate(target, { replace: true });
  }, [navigate]);
}
