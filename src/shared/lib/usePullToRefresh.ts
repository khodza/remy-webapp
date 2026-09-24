import { useEffect, useRef, useState, type RefObject } from 'react';
import { useHapticFeedback } from './telegram';

/** Pull this far (after resistance) and let go to refresh. */
export const PULL_THRESHOLD = 64;
const MAX_PULL = 96;
/** The spinner stays this tall while the refresh runs. */
export const PULL_HOLD = 44;
/** A finger that rests this long before moving is holding a row (drag), not pulling. */
const HOLD_MS = 300;
const SLOP = 10;

export interface PullState {
  /** How far the content is pulled down, in px. */
  distance: number;
  /** Past the threshold: letting go refreshes. */
  ready: boolean;
  refreshing: boolean;
}

/**
 * Pull down at the top of a scroll container to refresh. Touch only and
 * deliberately small:
 * - it starts only at scrollTop 0, on a mostly vertical move that begins
 *   right away, so a long-press drag (Timeline blocks, Week rows) or a
 *   sideways swipe never turns into a pull;
 * - while pulling it cancels the touchmove so the page does not bounce
 *   (Telegram's swipe-to-close is off, see app/init.ts);
 * - a gesture another handler already cancelled is left alone.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<unknown>) | undefined,
): PullState {
  const [state, setState] = useState<PullState>({ distance: 0, ready: false, refreshing: false });
  const haptic = useHapticFeedback();
  const latest = useRef({ onRefresh, haptic });
  latest.current = { onRefresh, haptic };
  const refreshing = useRef(false);
  const enabled = onRefresh !== undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    let start: { x: number; y: number; t: number } | null = null;
    let pulling = false;
    let distance = 0;

    const reset = () => {
      start = null;
      pulling = false;
      distance = 0;
    };

    const onStart = (event: TouchEvent) => {
      reset();
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch || refreshing.current || el.scrollTop > 0) return;
      start = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      if (event.defaultPrevented) {
        // Someone else (a drag) owns this gesture.
        if (pulling) setState({ distance: 0, ready: false, refreshing: false });
        reset();
        return;
      }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!pulling) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        const early = event.timeStamp - start.t < HOLD_MS;
        if (!early || dy <= 0 || Math.abs(dx) > dy || el.scrollTop > 0) {
          start = null;
          return;
        }
        pulling = true;
      }
      event.preventDefault();
      const next = Math.min(MAX_PULL, Math.max(0, (dy - SLOP) * 0.5));
      if (next >= PULL_THRESHOLD && distance < PULL_THRESHOLD) latest.current.haptic.impact('light');
      distance = next;
      setState({ distance: next, ready: next >= PULL_THRESHOLD, refreshing: false });
    };

    const onEnd = () => {
      const go = pulling && distance >= PULL_THRESHOLD;
      reset();
      if (!go) {
        setState((s) => (s.distance === 0 && !s.refreshing ? s : { distance: 0, ready: false, refreshing: false }));
        return;
      }
      refreshing.current = true;
      setState({ distance: PULL_HOLD, ready: true, refreshing: true });
      const began = Date.now();
      void Promise.resolve(latest.current.onRefresh?.())
        .catch(() => undefined)
        // Keep the spinner long enough to be seen.
        .then(() => new Promise((resolve) => setTimeout(resolve, Math.max(0, 450 - (Date.now() - began)))))
        .then(() => {
          refreshing.current = false;
          setState({ distance: 0, ready: false, refreshing: false });
        });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // The callback is read from a ref; only switching it on or off re-binds.
  }, [ref, enabled]);

  return state;
}
