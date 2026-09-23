import { useEffect } from 'react';
import { create } from 'zustand';
import { cx } from './cx';

export interface ToastOptions {
  message: string;
  /** "Undo": runs instead of `onTimeout`. */
  action?: { label: string; onClick: () => void };
  /**
   * Runs when the toast goes away without its action: after the timer, when
   * another toast replaces it, or when the app is hidden. This is how a
   * deferred delete commits.
   */
  onTimeout?: () => void;
  durationMs?: number;
  tone?: 'default' | 'danger';
}

interface ActiveToast extends ToastOptions {
  id: number;
}

const useToastStore = create<{ current: ActiveToast | null }>(() => ({ current: null }));
let seq = 0;

/** Settles the visible toast: its deferred action runs unless `undone`. */
function settle(undone: boolean): void {
  const current = useToastStore.getState().current;
  if (!current) return;
  useToastStore.setState({ current: null });
  if (undone) current.action?.onClick();
  else current.onTimeout?.();
}

/** Shows one toast; a previous one settles first (its delete goes through). */
export function toast(options: ToastOptions): void {
  settle(false);
  useToastStore.setState({ current: { ...options, id: ++seq } });
}

/** Runs any pending deferred action now (before navigation or unmount). */
export function flushToast(): void {
  settle(false);
}

export function Toaster() {
  const current = useToastStore((s) => s.current);

  useEffect(() => {
    if (!current) return undefined;
    const timer = setTimeout(() => settle(false), current.durationMs ?? (current.action ? 5000 : 2600));
    return () => clearTimeout(timer);
  }, [current]);

  // Closing the Mini App within the Undo window must not lose the action.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') settle(false);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushToast);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushToast);
    };
  }, []);

  if (!current) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-50 flex justify-center bottom-[calc(var(--tg-viewport-safe-area-inset-bottom,0px)+var(--dev-main-button-space,0px)+12px)]"
      role="status"
      aria-live="polite"
    >
      <div
        key={current.id}
        className={cx(
          'pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl py-1.5 pl-4 pr-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.18)] [animation:remy-toast-in_.2s_ease-out]',
          current.tone === 'danger' ? 'bg-danger text-on-status' : 'bg-text text-bg',
        )}
      >
        <span className="line-clamp-2 min-w-0 flex-1 break-words text-[14px] font-bold">{current.message}</span>
        {current.action ? (
          <button type="button" onClick={() => settle(true)} className="relative min-h-10 shrink-0 rounded-xl px-3 text-[14px] font-extrabold text-accent-soft active:opacity-70 before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']">
            {current.action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
