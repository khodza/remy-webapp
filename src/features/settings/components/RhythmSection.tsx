import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, type Settings, type UpdateSettingsRequest } from '@/shared/api';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { useSettings, useUpdateSettings } from '../hooks';

const FIRST_NUDGE_OPTIONS = [10, 15, 30, 60] as const;
const SECOND_NUDGE_OPTIONS = [60, 120, 180, 240] as const;
const DEFAULT_FIRST_NUDGE = 30;

const CARD =
  'overflow-hidden rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]';
const ROW =
  'flex min-h-11 items-center gap-3 border-t border-[color:var(--color-hairline)] px-4 py-2.5 first:border-t-0';
const ROW_LABEL = 'flex-1 font-sans text-[15px] font-medium text-[color:var(--color-text)]';
const HINT = 'px-4 pb-3 -mt-1 font-sans text-xs text-[color:var(--color-text-2)]';
const INPUT =
  'min-h-9 rounded-[10px] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-2.5 font-sans text-[15px] tabular-nums text-[color:var(--color-text)] focus:border-[color:var(--color-accent)] focus:outline-none disabled:opacity-40';

/**
 * Daily rhythm: brief, review, weekly wrap, quiet hours, nudges, week start.
 * Every control saves on its own (a PATCH with only that nested field);
 * the settings hook is optimistic and rolls back on failure.
 */
export function RhythmSection() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const haptic = useHapticFeedback();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const save = (patch: UpdateSettingsRequest) => {
    setError(null);
    update.mutate(patch, {
      onSuccess: () => {
        haptic.notify('success');
        setSaved(true);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 1500);
      },
      onError: (err) => {
        haptic.notify('error');
        setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
      },
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          Daily rhythm
        </h2>
        <span
          aria-live="polite"
          className={`font-sans text-xs text-[color:var(--color-success)] transition-opacity ${
            saved ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Saved
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] bg-[color:var(--color-danger-soft)] px-4 py-2.5 font-sans text-xs text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}

      {settings.isPending && (
        <div className={`${CARD} h-40 animate-pulse bg-[color:var(--color-surface-2)]`} />
      )}
      {settings.isError && (
        <div className={`${CARD} flex items-center justify-between px-4 py-3`}>
          <span className="font-sans text-sm text-[color:var(--color-text-2)]">
            Could not load your settings.
          </span>
          <button
            type="button"
            onClick={() => void settings.refetch()}
            className="min-h-11 px-2 font-sans text-sm font-medium text-[color:var(--color-accent)]"
          >
            Retry
          </button>
        </div>
      )}
      {settings.data && <RhythmControls settings={settings.data} save={save} />}
    </section>
  );
}

function RhythmControls({
  settings: s,
  save,
}: {
  settings: Settings;
  save: (patch: UpdateSettingsRequest) => void;
}) {
  const weekEnd = s.weekStartsOn === 1 ? 'Sunday' : 'Saturday';
  const firstNudge = s.escalation.stepsMinutes[0] ?? DEFAULT_FIRST_NUDGE;
  const secondNudge = s.escalation.stepsMinutes[1] ?? null;
  const steps = (first: number, second: number | null): number[] =>
    second !== null && second > first ? [first, second] : [first];

  return (
    <>
      {/* Messages from Remy */}
      <div className={CARD}>
        <Row label="Morning brief">
          <TimeInput
            id="rhythm-brief-time"
            label="Morning brief time"
            value={s.morningBrief.time}
            disabled={!s.morningBrief.enabled}
            onChange={(time) => save({ morningBrief: { time } })}
          />
          <Switch
            label="Morning brief"
            checked={s.morningBrief.enabled}
            onChange={(enabled) => save({ morningBrief: { enabled } })}
          />
        </Row>
        <Row label="Evening review">
          <TimeInput
            id="rhythm-review-time"
            label="Evening review time"
            value={s.eveningReview.time}
            disabled={!s.eveningReview.enabled}
            onChange={(time) => save({ eveningReview: { time } })}
          />
          <Switch
            label="Evening review"
            checked={s.eveningReview.enabled}
            onChange={(enabled) => save({ eveningReview: { enabled } })}
          />
        </Row>
        <Row label="Weekly wrap">
          <Switch
            label="Weekly wrap"
            checked={s.weeklyWrap.enabled}
            onChange={(enabled) => save({ weeklyWrap: { enabled } })}
          />
        </Row>
        <p className={HINT}>
          Sent on {weekEnd} at the evening-review time ({s.eveningReview.time}).
        </p>
      </div>

      {/* Quiet hours */}
      <div className={CARD}>
        <Row label="Quiet hours">
          <Switch
            label="Quiet hours"
            checked={s.quietHours.enabled}
            onChange={(enabled) => save({ quietHours: { enabled } })}
          />
        </Row>
        <Row label="From">
          <TimeInput
            id="rhythm-quiet-from"
            label="Quiet hours start"
            value={s.quietHours.from}
            disabled={!s.quietHours.enabled}
            onChange={(from) => save({ quietHours: { from } })}
          />
        </Row>
        <Row label="Until">
          <TimeInput
            id="rhythm-quiet-to"
            label="Quiet hours end"
            value={s.quietHours.to}
            disabled={!s.quietHours.enabled}
            onChange={(to) => save({ quietHours: { to } })}
          />
        </Row>
        <Row label="High priority can ring">
          <Switch
            label="High priority can ring during quiet hours"
            checked={s.quietHours.allowHighPriority}
            disabled={!s.quietHours.enabled}
            onChange={(allowHighPriority) => save({ quietHours: { allowHighPriority } })}
          />
        </Row>
        <p className={HINT}>Reminders due in this window arrive when it ends.</p>
      </div>

      {/* Nudges */}
      <div className={CARD}>
        <Row label="Nudge if ignored">
          <Switch
            label="Nudge if a reminder is ignored"
            checked={s.escalation.enabled}
            onChange={(enabled) => save({ escalation: { enabled } })}
          />
        </Row>
        <Row label="First nudge">
          <select
            id="rhythm-nudge-first"
            aria-label="First nudge after"
            className={INPUT}
            value={firstNudge}
            disabled={!s.escalation.enabled}
            onChange={(e) => {
              const first = Number(e.target.value);
              // A second nudge that is no longer later than the first is dropped.
              save({ escalation: { stepsMinutes: steps(first, secondNudge) } });
            }}
          >
            {FIRST_NUDGE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                after {m} min
              </option>
            ))}
          </select>
        </Row>
        <Row label="Second nudge">
          <select
            id="rhythm-nudge-second"
            aria-label="Second nudge after"
            className={INPUT}
            value={secondNudge ?? ''}
            disabled={!s.escalation.enabled}
            onChange={(e) => {
              const second = e.target.value === '' ? null : Number(e.target.value);
              save({ escalation: { stepsMinutes: steps(firstNudge, second) } });
            }}
          >
            <option value="">none</option>
            {SECOND_NUDGE_OPTIONS.map((m) => (
              <option key={m} value={m} disabled={m <= firstNudge}>
                after {m / 60} h
              </option>
            ))}
          </select>
        </Row>
        <p className={HINT}>
          Counted from the reminder. Low-priority tasks are never nudged.
        </p>
      </div>

      {/* Calendar */}
      <div className={CARD}>
        <Row label="Week starts on">
          <div
            role="radiogroup"
            aria-label="Week starts on"
            className="grid grid-cols-2 gap-1 rounded-[14px] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] p-1"
          >
            {(
              [
                { value: 1, label: 'Monday' },
                { value: 0, label: 'Sunday' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={s.weekStartsOn === option.value}
                onClick={() => {
                  if (s.weekStartsOn !== option.value) save({ weekStartsOn: option.value });
                }}
                className={`min-h-9 rounded-[10px] px-3 font-sans text-[13px] font-medium transition ${
                  s.weekStartsOn === option.value
                    ? 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-sm'
                    : 'text-[color:var(--color-text-2)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Row>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ROW}>
      <span className={ROW_LABEL}>{label}</span>
      {children}
    </div>
  );
}

/** 24-hour HH:mm, 5-minute steps; saves only complete, changed values. */
function TimeInput({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      id={id}
      type="time"
      step={300}
      aria-label={label}
      className={INPUT}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value.slice(0, 5);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(next) && next !== value) onChange(next);
      }}
    />
  );
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const haptic = useHapticFeedback();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic.selection();
        onChange(!checked);
      }}
      // 44×44 hit area around a 42×26 track.
      className="-my-2 flex h-11 w-12 shrink-0 items-center justify-end disabled:opacity-40"
    >
      <span
        className={`relative h-[26px] w-[42px] rounded-full transition-colors ${
          checked ? 'bg-[color:var(--color-success)]' : 'bg-[color:var(--color-hairline)]'
        }`}
      >
        <span
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-[left] ${
            checked ? 'left-[19px]' : 'left-[3px]'
          }`}
        />
      </span>
    </button>
  );
}
