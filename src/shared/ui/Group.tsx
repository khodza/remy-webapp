import type { PropsWithChildren, ReactNode } from 'react';
import { cx } from './cx';

/** Uppercase section label with an optional action on the right. */
export function SectionHeader({ label, right }: { label: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-9 items-end justify-between px-4 pb-1.5 pt-4">
      <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">{label}</span>
      {right ? <span className="text-[12.5px] font-bold text-accent">{right}</span> : null}
    </div>
  );
}

/** One rounded container per section; rows inside are separated by rules. */
export function Group({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cx(
        'mx-3 overflow-hidden rounded-2xl border border-rule bg-surface',
        '[&>*+*]:border-t [&>*+*]:border-rule',
        className,
      )}
    >
      {children}
    </div>
  );
}
