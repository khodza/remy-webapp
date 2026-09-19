import { cx } from './cx';

interface TimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** "HH:mm" in 5-minute steps; reports only complete, changed values. */
export function TimeField({ value, onChange, label, disabled, className }: TimeFieldProps) {
  return (
    <input
      type="time"
      step={300}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value.slice(0, 5);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(next) && next !== value) onChange(next);
      }}
      className={cx('tnum min-h-10 rounded-[10px] border border-rule bg-past px-2.5 text-[15px] font-bold text-text disabled:opacity-40', className)}
    />
  );
}
