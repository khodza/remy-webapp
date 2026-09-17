import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, addHours, nextMonday, nextSaturday } from 'date-fns';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { RecurrenceSchema, type Task } from '@/shared/api';
import {
  atTimeInTz,
  fireAt,
  formatTime,
  fromLocalInputValue,
  inTz,
  relativeToNow,
  toLocalInputValue,
  useUserTimezone,
} from '@/shared/lib/dates';
import { useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import { useDeleteTask, useUpdateTask } from '../hooks';
import { RecurrencePicker } from './RecurrencePicker';

/**
 * The datetime-local input holds wall-clock time in the user's zone; the
 * schema is built per render so it can convert with that zone and compare
 * against "now". An already-overdue task may keep its past time (the user
 * is editing something else); a *changed* time must be in the future.
 */
function buildSchema(tz: string, originalInput: string) {
  return z.object({
    description: z.string().trim().min(1, 'Required').max(4000),
    scheduledAt: z
      .string()
      .min(1, 'Required')
      .refine((v) => fromLocalInputValue(v, tz) !== null, 'Invalid date/time')
      .refine(
        (v) =>
          v === originalInput ||
          (fromLocalInputValue(v, tz)?.getTime() ?? 0) > Date.now(),
        'Pick a time in the future',
      ),
    recurrence: RecurrenceSchema.nullable(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface Preset {
  key: string;
  label: string;
  compute: (now: Date, tz: string) => Date;
}

const PRESETS: Preset[] = [
  {
    key: 'in-1-hour',
    label: '+1 hour',
    compute: (now) => addHours(now, 1),
  },
  {
    key: 'tonight',
    label: 'Tonight 20:00',
    compute: (now, tz) => {
      const tonight = atTimeInTz(now, tz, 20);
      return tonight.getTime() > now.getTime()
        ? tonight
        : atTimeInTz(addDays(inTz(now, tz), 1), tz, 20);
    },
  },
  {
    key: 'tomorrow-9am',
    label: 'Tomorrow 09:00',
    compute: (now, tz) => atTimeInTz(addDays(inTz(now, tz), 1), tz, 9),
  },
  {
    key: 'weekend',
    label: 'Saturday 10:00',
    compute: (now, tz) => atTimeInTz(nextSaturday(inTz(now, tz)), tz, 10),
  },
  {
    key: 'next-monday',
    label: 'Monday 09:00',
    compute: (now, tz) => atTimeInTz(nextMonday(inTz(now, tz)), tz, 9),
  },
];

interface TaskEditFormProps {
  task: Task;
}

export function TaskEditForm({ task }: TaskEditFormProps) {
  const navigate = useNavigate();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const haptic = useHapticFeedback();
  const tz = useUserTimezone();
  const originalInput = useMemo(
    () => toLocalInputValue(task.scheduledAt, tz),
    [task.scheduledAt, tz],
  );
  const schema = useMemo(
    () => buildSchema(tz, originalInput),
    [tz, originalInput],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      description: task.description,
      scheduledAt: originalInput,
      recurrence: task.recurrence ?? null,
    },
  });

  const recurrence = watch('recurrence');
  const scheduledInput = watch('scheduledAt');
  const isOverdue =
    task.status === 'pending' && fireAt(task).getTime() < Date.now();
  const keptPastTime = isOverdue && scheduledInput === originalInput;

  const onSubmit = handleSubmit((data) => {
    const scheduledAt = fromLocalInputValue(data.scheduledAt, tz);
    if (!scheduledAt) return;
    haptic.impact('medium');
    update.mutate(
      {
        id: task.id,
        patch: {
          description: data.description,
          scheduledAt,
          recurrence: data.recurrence,
        },
      },
      {
        onSuccess: () => {
          haptic.notify('success');
          navigate('/', { replace: true });
        },
        onError: () => haptic.notify('error'),
      },
    );
  });

  const applyPreset = (preset: Preset) => {
    const next = preset.compute(new Date(), tz);
    setValue('scheduledAt', toLocalInputValue(next, tz), {
      shouldDirty: true,
      shouldValidate: true,
    });
    haptic.selection();
  };

  useMainButton({
    text: update.isPending ? 'Saving…' : 'Save changes',
    enabled: isDirty && isValid && !update.isPending,
    loading: update.isPending,
    onClick: () => void onSubmit(),
  });

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-1 flex-col gap-4"
    >
      {(isOverdue || task.snoozedUntil) && (
        <div className="rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-2.5 font-sans text-xs text-[color:var(--color-text-2)]">
          {task.snoozedUntil && (
            <p>
              Snoozed until{' '}
              <span className="tabular-nums text-[color:var(--color-text)]">
                {formatTime(task.snoozedUntil, tz)}
              </span>
              {task.recurrence ? ' (this occurrence only)' : ''}
            </p>
          )}
          {isOverdue && (
            <p className="text-[color:var(--color-danger)]">
              {relativeToNow(fireAt(task))}
              {keptPastTime ? ' — pick a new time or mark it done' : ''}
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          Description
        </span>
        <textarea
          rows={3}
          {...register('description')}
          className="resize-none rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 font-sans text-[15px] leading-snug tracking-tight text-[color:var(--color-text)] focus:border-[color:var(--color-accent)] focus:outline-none"
          onBlur={() => window.scrollTo(0, 0)}
        />
        {errors.description && (
          <span className="font-sans text-xs text-[color:var(--color-danger)]">
            {errors.description.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          When · {tz}
        </span>
        <input
          type="datetime-local"
          {...register('scheduledAt')}
          className="rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 font-sans text-[15px] tabular-nums text-[color:var(--color-text)] focus:border-[color:var(--color-accent)] focus:outline-none"
          onBlur={() => window.scrollTo(0, 0)}
        />
        {errors.scheduledAt && (
          <span className="font-sans text-xs text-[color:var(--color-danger)]">
            {errors.scheduledAt.message}
          </span>
        )}
        <div className="mt-2 -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="whitespace-nowrap rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-3 py-1.5 font-sans text-[12px] text-[color:var(--color-text-2)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </label>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          Repeat
        </span>
        <RecurrencePicker
          value={recurrence ?? null}
          onChange={(next) => {
            setValue('recurrence', next, {
              shouldDirty: true,
              shouldValidate: true,
            });
            haptic.selection();
          }}
          disabled={update.isPending}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          haptic.impact('heavy');
          remove.mutate(task.id, {
            onSuccess: () => {
              haptic.notify('success');
              navigate('/', { replace: true });
            },
          });
        }}
        disabled={remove.isPending}
        className="mt-auto rounded-[var(--radius-big)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-4 py-3 font-sans text-sm font-medium text-[color:var(--color-danger)] transition disabled:opacity-60"
      >
        {remove.isPending ? 'Deleting…' : 'Delete reminder'}
      </button>

      {update.isError && (
        <div className="rounded-[var(--radius-card)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-3">
          <p className="font-sans text-xs text-[color:var(--color-danger)]">
            {update.error instanceof Error
              ? update.error.message
              : 'Failed to save changes.'}
          </p>
        </div>
      )}
    </form>
  );
}
