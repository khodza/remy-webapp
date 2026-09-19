import { forwardRef, useLayoutEffect, useRef, type PropsWithChildren } from 'react';
import { useBackButton } from '@/shared/lib/telegram';
import { cx } from './cx';

interface ScreenProps {
  /** Show Telegram's Back button (off on the root screen). */
  back?: boolean;
  className?: string;
}

/**
 * The scrolling page. Starts at the top on every navigation, and keeps its
 * content clear of the bottom safe area (and of the dev MainButton mirror).
 */
export const Screen = forwardRef<HTMLElement, PropsWithChildren<ScreenProps>>(
  function Screen({ back = true, className, children }, ref) {
    useBackButton(back);
    const local = useRef<HTMLElement | null>(null);
    useLayoutEffect(() => {
      local.current?.scrollTo({ top: 0 });
    }, []);
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
        {children}
      </main>
    );
  },
);
