import { Check } from 'lucide-react';
import { cx } from './cx';

interface CheckCircleProps {
  done: boolean;
  onToggle: () => void;
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/** The complete circle: 24px to the eye, 44px to the thumb. */
export function CheckCircle({ done, onToggle, label, tone = 'default', disabled }: CheckCircleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={done}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span
        className={cx(
          'flex h-6 w-6 items-center justify-center rounded-full border-2 transition',
          done ? 'border-ok bg-ok text-white' : tone === 'danger' ? 'border-danger' : 'border-faint',
        )}
      >
        {done ? <Check size={15} strokeWidth={3.5} /> : null}
      </span>
    </button>
  );
}
