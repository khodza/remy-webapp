import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { isBackVisible, isMockEnv, subscribeBack, triggerBack, useMainButtonStore } from '@/shared/lib/telegram';
import { cx } from './cx';

/**
 * Outside Telegram (dev mock mode, screenshots) draws what Telegram would:
 * the header with Back and ⋯ Settings, and the MainButton at the bottom.
 * In Telegram it renders only its children.
 */
export function DevChrome({ children }: PropsWithChildren) {
  if (!isMockEnv()) return <>{children}</>;
  return (
    <>
      <DevHeader />
      {children}
      <DevMainButton />
    </>
  );
}

function DevHeader() {
  const back = useSyncExternalStore(subscribeBack, isBackVisible);
  return (
    // z-50: Telegram's header sits outside the webview, so sheets never cover it.
    <div className="relative z-50 flex h-11 shrink-0 items-center justify-between border-b border-rule bg-bg px-1 text-[14px] font-bold text-muted" data-dev-chrome>
      <button type="button" onClick={back ? triggerBack : undefined} className="flex h-11 min-w-20 items-center gap-0.5 px-2 text-accent">
        {back ? (
          <>
            <ChevronLeft size={20} /> Back
          </>
        ) : (
          <span className="text-muted">Close</span>
        )}
      </button>
      <span className="text-text">Remy</span>
      <button type="button" aria-label="Settings" onClick={() => (window.location.hash = '#/settings')} className="flex h-11 min-w-20 items-center justify-end px-3">
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}

function DevMainButton() {
  const { visible, text, enabled, loading, variant, onClick } = useMainButtonStore();

  useEffect(() => {
    document.documentElement.style.setProperty('--dev-main-button-space', visible ? '68px' : '0px');
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-bg px-3 pb-2.5 pt-2" data-dev-chrome>
      <button
        type="button"
        disabled={!enabled || loading}
        onClick={() => onClick?.()}
        className={cx(
          'flex min-h-12 w-full items-center justify-center rounded-[14px] text-[15px] font-extrabold transition disabled:opacity-50',
          variant === 'ok' ? 'bg-ok text-surface' : 'bg-accent text-accent-fg',
        )}
      >
        {loading ? '…' : text}
      </button>
    </div>
  );
}
