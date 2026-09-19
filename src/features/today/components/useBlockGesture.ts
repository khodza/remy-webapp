import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type Mode = 'idle' | 'pending' | 'swipe' | 'drag' | 'scroll';

const LONG_PRESS_MS = 380;
const SLOP = 8;

interface Options {
  enabled: boolean;
  /** Called once when a long press turns into a drag. */
  onDragStart?: () => void;
  onSwipe: (dx: number) => void;
  onDrop: (dy: number) => void;
}

/**
 * One gesture per touch on a timeline block: swipe right (complete),
 * long-press then drag vertically (move), or a plain vertical move, which
 * is left to the page to scroll. Taps still reach onClick unless the
 * touch became a swipe or a drag.
 */
export function useBlockGesture({ enabled, onDragStart, onSwipe, onDrop }: Options) {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const [mode, setMode] = useState<Mode>('idle');
  const state = useRef<{ mode: Mode; x: number; y: number; timer: ReturnType<typeof setTimeout> | undefined; el: HTMLElement | null; id: number }>({
    mode: 'idle',
    x: 0,
    y: 0,
    timer: undefined,
    el: null,
    id: 0,
  });
  const swallowClick = useRef(false);
  const node = useRef<HTMLElement | null>(null);

  const set = (next: Mode) => {
    state.current.mode = next;
    setMode(next);
  };
  const reset = () => {
    clearTimeout(state.current.timer);
    set('idle');
    setOffset({ dx: 0, dy: 0 });
  };

  // While dragging, the page must not scroll: only a non-passive touchmove
  // listener can stop it once the finger is down.
  useEffect(() => {
    const el = node.current;
    if (!el) return undefined;
    const block = (event: TouchEvent) => {
      if (state.current.mode === 'drag') event.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  useEffect(() => () => clearTimeout(state.current.timer), []);

  const handlers = {
    ref: (el: HTMLElement | null) => {
      node.current = el;
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button > 0) return;
      const s = state.current;
      s.x = event.clientX;
      s.y = event.clientY;
      s.el = event.currentTarget;
      s.id = event.pointerId;
      set('pending');
      clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        if (state.current.mode !== 'pending') return;
        set('drag');
        try {
          s.el?.setPointerCapture(s.id);
        } catch {
          // pointer already gone
        }
        onDragStart?.();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const s = state.current;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      if (s.mode === 'pending') {
        if (dx > SLOP && Math.abs(dx) > Math.abs(dy) * 1.5) {
          clearTimeout(s.timer);
          set('swipe');
          event.currentTarget.setPointerCapture(event.pointerId);
        } else if (Math.abs(dy) > SLOP || Math.abs(dx) > SLOP) {
          clearTimeout(s.timer);
          set('scroll');
        }
      }
      if (s.mode === 'swipe') setOffset({ dx: Math.max(0, Math.min(dx, 120)), dy: 0 });
      if (s.mode === 'drag') setOffset({ dx: 0, dy });
    },
    onPointerUp: () => {
      const s = state.current;
      if (s.mode === 'swipe') {
        swallowClick.current = true;
        onSwipe(offset.dx);
      } else if (s.mode === 'drag') {
        swallowClick.current = true;
        onDrop(offset.dy);
      }
      reset();
    },
    onPointerCancel: reset,
    onContextMenu: (event: React.MouseEvent) => {
      // Long-press is ours on touch screens, not the browser's menu.
      if (state.current.mode !== 'idle') event.preventDefault();
    },
  };

  /** True once for a click that ended a swipe or drag. */
  const takeSwallowedClick = () => {
    const swallowed = swallowClick.current;
    swallowClick.current = false;
    return swallowed;
  };

  return { handlers, offset, dragging: mode === 'drag', swiping: mode === 'swipe', takeSwallowedClick };
}
