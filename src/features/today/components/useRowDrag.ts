import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const LONG_PRESS_MS = 380;
const SLOP = 8;

export interface RowDragState<T> {
  item: T;
  x: number;
  y: number;
  /** The drop target under the finger (`data-drop-day`), if any. */
  over: string | null;
}

interface Options<T> {
  /** A hold turned into a drag. */
  onStart?: (item: T) => void;
  /** The finger moved onto another target (or off all of them). */
  onOver?: (target: string | null) => void;
  onDrop: (item: T, target: string) => void;
}

/** The `data-drop-day` element under a point, skipping the drag ghost. */
function targetAt(x: number, y: number): string | null {
  const el = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
  return el?.closest<HTMLElement>('[data-drop-day]')?.dataset.dropDay ?? null;
}

/**
 * Hold a row, then drag it onto a drop target (any element with
 * `data-drop-day`). Same feel as the Timeline blocks: a plain vertical move
 * before the hold scrolls the page, a tap still opens the row, and while
 * dragging the page does not scroll (iOS WebKit needs a non-passive
 * touchmove to stop it; pointer events alone cannot).
 */
export function useRowDrag<T>({ onStart, onOver, onDrop }: Options<T>) {
  const [drag, setDrag] = useState<RowDragState<T> | null>(null);
  const live = useRef<{
    item: T | null;
    x: number;
    y: number;
    dragging: boolean;
    over: string | null;
    timer: ReturnType<typeof setTimeout> | undefined;
    swallowClick: boolean;
  }>({ item: null, x: 0, y: 0, dragging: false, over: null, timer: undefined, swallowClick: false });
  const handlers = useRef({ onStart, onOver, onDrop });
  handlers.current = { onStart, onOver, onDrop };

  useEffect(() => {
    const state = live.current;
    const block = (event: TouchEvent) => {
      if (state.dragging) event.preventDefault();
    };
    window.addEventListener('touchmove', block, { passive: false });
    return () => {
      window.removeEventListener('touchmove', block);
      clearTimeout(state.timer);
    };
  }, []);

  const end = () => {
    const s = live.current;
    clearTimeout(s.timer);
    s.item = null;
    s.dragging = false;
    s.over = null;
    setDrag(null);
  };

  const bind = (item: T) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button > 0) return;
      const s = live.current;
      const el = event.currentTarget;
      const pointerId = event.pointerId;
      s.swallowClick = false;
      s.item = item;
      s.x = event.clientX;
      s.y = event.clientY;
      s.dragging = false;
      clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        if (s.item !== item) return;
        s.dragging = true;
        try {
          el.setPointerCapture(pointerId);
        } catch {
          // the pointer is already gone
        }
        setDrag({ item, x: s.x, y: s.y, over: null });
        handlers.current.onStart?.(item);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const s = live.current;
      if (s.item === null) return;
      if (!s.dragging) {
        // Moving before the hold completes is a scroll, not a drag.
        if (Math.hypot(event.clientX - s.x, event.clientY - s.y) > SLOP) end();
        return;
      }
      const over = targetAt(event.clientX, event.clientY);
      if (over !== s.over) {
        s.over = over;
        handlers.current.onOver?.(over);
      }
      setDrag({ item: s.item, x: event.clientX, y: event.clientY, over });
    },
    onPointerUp: () => {
      const s = live.current;
      if (s.dragging && s.item !== null) {
        s.swallowClick = true;
        if (s.over !== null) handlers.current.onDrop(s.item, s.over);
      }
      end();
    },
    onPointerCancel: end,
    onContextMenu: (event: ReactMouseEvent) => {
      // A long press is ours, not the browser's menu.
      if (live.current.item !== null) event.preventDefault();
    },
    onClickCapture: (event: ReactMouseEvent) => {
      // The click that ends a drag must not open the row.
      if (live.current.swallowClick) {
        live.current.swallowClick = false;
        event.stopPropagation();
        event.preventDefault();
      }
    },
  });

  return { drag, bind, cancel: end };
}
