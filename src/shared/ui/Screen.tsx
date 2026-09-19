import { forwardRef, useLayoutEffect, useRef, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import { saveScroll, savedScroll } from '@/shared/lib/scrollMemory';
import { useBackButton } from '@/shared/lib/telegram';
import { cx } from './cx';

interface ScreenProps {
  /** Show Telegram's Back button (off on the root screen). */
  back?: boolean;
  className?: string;
}

/**
 * The scrolling page. A new screen starts at the top; going Back returns
 * to where it was left. Content stays clear of the bottom safe area (and
 * of the dev MainButton mirror).
 */
export const Screen = forwardRef<HTMLElement, PropsWithChildren<ScreenProps>>(
  function Screen({ back = true, className, children }, ref) {
    useBackButton(back);
    const { key } = useLocation();
    const local = useRef<HTMLElement | null>(null);

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
        {children}
      </main>
    );
  },
);
