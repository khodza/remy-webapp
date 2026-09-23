import { create } from 'zustand';

/**
 * The 12/24-hour preference for every time the app shows. Settings hold it
 * (`settings.hour12`, synced here by features/settings); the device keeps a
 * copy so the first paint already uses it. Not a secret, so localStorage is
 * fine (rule 5 is about auth).
 */
const KEY = 'remy.hour12';

function readCached(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** `data-clock` on <html> lets CSS size time columns for "11:45 PM". */
function markDocument(hour12: boolean): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.clock = hour12 ? '12' : '24';
}

export const useClockStore = create<{ hour12: boolean }>(() => {
  const hour12 = readCached();
  markDocument(hour12);
  return { hour12 };
});

export function setClockHour12(hour12: boolean): void {
  if (useClockStore.getState().hour12 === hour12) return;
  useClockStore.setState({ hour12 });
  markDocument(hour12);
  try {
    window.localStorage.setItem(KEY, hour12 ? '1' : '0');
  } catch {
    // private mode: the setting still holds it
  }
}
