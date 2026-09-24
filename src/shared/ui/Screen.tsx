import { RefreshCw } from 'lucide-react';
import { forwardRef, useLayoutEffect, useRef, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import { saveScroll, savedScroll } from '@/shared/lib/scrollMemory';
import { PULL_THRESHOLD, usePullToRefresh } from '@/shared/lib/usePullToRefresh';
import { useBackButton } from '@/shared/lib/telegram';
import { cx } from './cx';

interface ScreenProps {
  /** Show Telegram's Back button (off on the root screen). */
  back?: boolean;
  className?: string;
  /** Pull down at the top to run this (lists: refetch what is on screen). */
  onRefresh?: () => Promise<unknown>;
}

/**
 * The scrolling page. A new screen starts at the top; going Back returns
 * to where it was left. Content stays clear of the bottom safe area (and
 * of the dev MainButton mirror).
 */
export const Screen = forwardRef<HTMLElement, PropsWithChildren<ScreenProps>>(function Screen(
  { back = true, className, onRefresh, children },
  ref,
) {
  useBackButton(back);
  const { key } = useLocation();
  const local = useRef<HTMLElement | null>(null);
  const pull = usePullToRefresh(local, onRefresh);

  useLayoutEffect(() => {
    const main = local.current;
    if (!main) return undefined;
    main.scrollTo({ top: savedScroll(key) ?? 0 });
    return () => saveScroll(key, main.scrollTop);
  }, [key]);

  return (
    <main
      ref={(node) => {
        local.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={cx(
        // Children keep their height and the page scrolls; without
        // shrink-0 a rounded Group gets squashed on short screens.
        'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [&>*]:shrink-0',
        'pb-[calc(var(--tg-viewport-safe-area-inset-bottom,0px)+var(--dev-main-button-space,0px)+20px)]',
        className,
      )}
    >
      {onRefresh ? <PullIndicator distance={pull.distance} ready={pull.ready} refreshing={pull.refreshing} /> : null}
      {children}
    </main>
  );
});

/** The gap a pull opens at the top, with a spinner that turns as you pull. */
function PullIndicator({ distance, ready, refreshing }: { distance: number; ready: boolean; refreshing: boolean }) {
  return (
    <div
      className={cx(
        'flex items-end justify-center overflow-hidden',
        distance === 0 && 'transition-[height] duration-200',
      )}
      style={{ height: distance }}
      aria-hidden={!refreshing}
      role={refreshing ? 'status' : undefined}
      aria-label={refreshing ? 'Refreshing' : undefined}
    >
      <span
        className={cx(
          'mb-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-[0_1px_4px_rgb(16_24_40/0.15)]',
          ready ? 'text-accent' : 'text-muted',
        )}
      >
        <RefreshCw
          size={15}
          strokeWidth={2.5}
          className={refreshing ? 'animate-spin' : undefined}
          style={refreshing ? undefined : { transform: `rotate(${(distance / PULL_THRESHOLD) * 270}deg)` }}
        />
      </span>
    </div>
  );
}
