import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

type IconTone = 'accent' | 'warn' | 'danger' | 'ok';

const ICON_TONES: Record<IconTone, string> = {
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
};

interface FieldRowProps {
  icon?: ReactNode;
  iconTone?: IconTone;
  label: ReactNode;
  value?: ReactNode;
  /** Replaces value + chevron (a Toggle, a time input). */
  trailing?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  hint?: ReactNode;
}

/** Settings-style row: icon, label, value, chevron. Opens a sheet or a screen. */
export function FieldRow({ icon, iconTone = 'accent', label, value, trailing, onClick, danger, hint }: FieldRowProps) {
  const body = (
    <>
      {icon ? <span className={cx('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]', ICON_TONES[iconTone])}>{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[14.5px] font-bold', danger ? 'text-danger' : 'text-text')}>{label}</span>
        {hint ? <span className="block text-[12px] font-semibold text-muted">{hint}</span> : null}
      </span>
      {trailing ?? (
        <>
          {value !== undefined ? <span className="tnum max-w-[55%] truncate text-right text-[13.5px] font-bold text-muted">{value}</span> : null}
          {onClick ? <ChevronRight size={16} className="shrink-0 text-faint" /> : null}
        </>
      )}
    </>
  );
  const classes = 'flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-1.5 text-left';
  return onClick && !trailing ? (
    <button type="button" onClick={onClick} className={cx(classes, 'transition active:bg-past')}>
      {body}
    </button>
  ) : (
    <div className={classes}>{body}</div>
  );
}
