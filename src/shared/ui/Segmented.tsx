import { cx } from './cx';

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}

/** Two to four mutually exclusive choices (Timeline | List, Low | Normal | High). */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'sm' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-[10px] bg-past p-[3px]">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg font-extrabold transition',
              size === 'sm' ? 'min-h-8 px-2.5 text-[12px]' : 'min-h-10 flex-1 px-3 text-[13.5px]',
              on ? 'bg-surface text-text shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
