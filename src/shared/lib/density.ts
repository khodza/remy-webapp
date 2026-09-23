import { useSyncExternalStore } from 'react';

/**
 * Row density, a per-device preference (a small phone may want more rows
 * on screen; the account does not care). Stored in localStorage like the
 * other device prefs and applied as `data-density` on <html>, where the
 * row tokens in index.css (--spacing-row, --spacing-field, …) pick it up.
 */
export type Density = 'comfortable' | 'compact';

const KEY = 'remy.density';
const listeners = new Set<() => void>();
let current: Density | null = null;

export function readDensity(): Density {
  try {
    return window.localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

function apply(density: Density): void {
  if (density === 'compact') document.documentElement.dataset.density = 'compact';
  else delete document.documentElement.dataset.density;
}

/** At boot, before the first paint. */
export function applyStoredDensity(): void {
  apply(readDensity());
}

export function setDensity(density: Density): void {
  try {
    if (density === 'compact') window.localStorage.setItem(KEY, density);
    else window.localStorage.removeItem(KEY);
  } catch {
    // private mode: it still applies until the app closes
  }
  apply(density);
  current = density;
  listeners.forEach((listener) => listener());
}

function snapshot(): Density {
  current ??= readDensity();
  return current;
}

export function useDensity(): [Density, (density: Density) => void] {
  const density = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot,
    () => 'comfortable' as const,
  );
  return [density, setDensity];
}
