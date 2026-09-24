import { X } from 'lucide-react';
import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { suppressMainButton, useBackHandler } from '@/shared/lib/telegram';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Sticky actions under the scrolling body. */
  footer?: ReactNode;
}

/**
 * Bottom sheet for one field (When, Repeat, Category…). Telegram's Back
 * closes it instead of leaving the page, and the page's MainButton hides
 * while it is open.
 */
export function Sheet({ open, onClose, title, footer, children }: PropsWithChildren<SheetProps>) {
  useBackHandler(open, onClose);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const restore = suppressMainButton();
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      restore();
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-scrim [animation:remy-fade-in_.18s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[88%] flex-col rounded-t-2xl bg-surface outline-none [animation:remy-sheet-in_.24s_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-rule" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2 py-1 pl-4 pr-1.5">
          <h2 id={titleId} className="text-[17px] font-extrabold tracking-tight text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted active:bg-past"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer ? (
          <div className="flex gap-2 border-t border-rule px-4 pb-[calc(var(--tg-viewport-safe-area-inset-bottom,0px)+12px)] pt-3">
            {footer}
          </div>
        ) : (
          <div className="h-[var(--tg-viewport-safe-area-inset-bottom,0px)]" />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A choice inside a sheet: label, optional detail, a check when selected. */
export function SheetOption({
  label,
  detail,
  selected,
  onClick,
  icon,
}: {
  label: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={Boolean(selected)}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left transition active:bg-past aria-checked:bg-accent-soft"
    >
      {icon ? <span className="flex w-5 shrink-0 justify-center">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-text">{label}</span>
        {detail ? <span className="tnum block text-[12px] font-semibold text-muted">{detail}</span> : null}
      </span>
      {selected ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" /> : null}
    </button>
  );
}
