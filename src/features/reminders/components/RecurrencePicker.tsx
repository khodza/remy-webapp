import type { Recurrence } from '@/shared/api';
import { useUserTimezone } from '@/shared/lib/dates';
import { isCustomRecurrence, recurrenceLabel } from '../lib/recurrence';

interface RecurrenceOption {
  key: string;
  label: string;
  value: Recurrence | null;
}

const OPTIONS: RecurrenceOption[] = [
  { key: 'none', label: 'One-shot', value: null },
  { key: 'daily', label: 'Daily', value: { type: 'daily' } },
  { key: 'weekdays', label: 'Weekdays', value: { type: 'weekdays' } },
  { key: 'weekly', label: 'Weekly', value: { type: 'weekly' } },
  { key: 'monthly', label: 'Monthly', value: { type: 'monthly' } },
  { key: 'yearly', label: 'Yearly', value: { type: 'yearly' } },
];

function sameRecurrence(a: Recurrence | null, b: Recurrence | null): boolean {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  return a.intervalDays === b.intervalDays;
}

interface RecurrencePickerProps {
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
  disabled?: boolean;
}

export function RecurrencePicker({
  value,
  onChange,
  disabled,
}: RecurrencePickerProps) {
  const tz = useUserTimezone();
  // A rule set in chat ("every Mon and Thu until December") that the chips
  // cannot express: shown read-only, replaced only if another chip is picked.
  const isCustom = isCustomRecurrence(value);
  const isCustomInterval = !isCustom && value?.type === 'every_n_days';
  const intervalDays = value?.intervalDays ?? 3;

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          {isCustom && (
            <span
              data-selected="true"
              className="whitespace-nowrap rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 font-sans text-[12px] text-[color:var(--color-accent)]"
            >
              Custom: {recurrenceLabel(value, tz)}
            </span>
          )}
          {OPTIONS.map((opt) => {
            const selected = !isCustom && sameRecurrence(value ?? null, opt.value);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange(opt.value)}
                disabled={disabled}
                data-selected={selected ? 'true' : undefined}
                className="whitespace-nowrap rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-3 py-1.5 font-sans text-[12px] text-[color:var(--color-text-2)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50 data-[selected=true]:border-[color:var(--color-accent)] data-[selected=true]:bg-[color:var(--color-accent-soft)] data-[selected=true]:text-[color:var(--color-accent)]"
              >
                {opt.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() =>
              onChange({ type: 'every_n_days', intervalDays })
            }
            disabled={disabled}
            data-selected={isCustomInterval ? 'true' : undefined}
            className="whitespace-nowrap rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-3 py-1.5 font-sans text-[12px] text-[color:var(--color-text-2)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50 data-[selected=true]:border-[color:var(--color-accent)] data-[selected=true]:bg-[color:var(--color-accent-soft)] data-[selected=true]:text-[color:var(--color-accent)]"
          >
            Every N days
          </button>
        </div>
      </div>

      {isCustom && (
        <p className="font-sans text-[12px] text-[color:var(--color-text-2)]">
          Set by chat. Pick another option to replace it.
        </p>
      )}

      {isCustomInterval && (
        <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2">
          <span className="font-sans text-[13px] text-[color:var(--color-text-2)]">
            Every
          </span>
          <input
            type="number"
            min={1}
            max={365}
            value={intervalDays}
            onChange={(e) => {
              const n = Math.max(1, Math.min(365, Number(e.target.value) || 1));
              onChange({ type: 'every_n_days', intervalDays: n });
            }}
            disabled={disabled}
            className="w-16 rounded-md border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-2 py-1 text-center font-mono text-sm tabular-nums text-[color:var(--color-text)] focus:border-[color:var(--color-accent)] focus:outline-none"
          />
          <span className="font-sans text-[13px] text-[color:var(--color-text-2)]">
            days
          </span>
        </div>
      )}
    </div>
  );
}
