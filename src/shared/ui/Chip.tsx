import type { ReactNode } from 'react';
import { cx } from './cx';

interface ChipProps {
  label: ReactNode;
  /** The resulting time under the label ("15:47"). */
  sub?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

/** Snooze choice that shows what it will do. */
export function Chip({ label, sub, onClick, disabled, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex min-h-11 flex-col items-center justify-center rounded-xl bg-past px-1 py-1.5 text-center text-[12.5px] font-extrabold text-text transition active:scale-[0.97] disabled:opacity-50',
        className,
      )}
    >
      <span>{label}</span>
      {sub ? <span className="tnum text-[10.5px] font-bold text-muted">{sub}</span> : null}
    </button>
  );
}
