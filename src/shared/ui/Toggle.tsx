import { cx } from './cx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** On/off switch with a 44px hit area. */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="-my-2 flex h-11 w-[54px] shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span className={cx('relative h-[26px] w-[42px] rounded-full transition-colors', checked ? 'bg-ok' : 'bg-rule')}>
        <span
          className={cx(
            'absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-[left]',
            checked ? 'left-[19px]' : 'left-[3px]',
          )}
        />
      </span>
    </button>
  );
}
