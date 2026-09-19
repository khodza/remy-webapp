import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, addHours, nextMonday, nextSaturday } from 'date-fns';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { CategoryChip, useCategories } from '@/features/categories';
import {
  PrioritySchema,
  type Priority,
  type Recurrence,
  type Task,
  type TaskPatch,
} from '@/shared/api';
import {
  atTimeInTz,
  fireAt,
  formatDayShort,
  formatTime,
  fromLocalInputValue,
  inTz,
  relativeToNow,
  toLocalInputValue,
  useUserTimezone,
} from '@/shared/lib/dates';
import { useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import {
  useCompleteTask,
  useDeleteTask,
  useReopenTask,
  useSnoozeTask,
  useUpdateTask,
} from '../hooks';
import { RecurrencePicker } from './RecurrencePicker';

/**
 * The datetime-local input holds wall-clock time in the user's zone; the
 * schema is built per render so it can convert with that zone and compare
 * against "now". An already-overdue task may keep its past time (the user
 * is editing something else); a *changed* time must be in the future. With
 * "No date" on, the task is a todo and the time is ignored.
 */
function buildSchema(tz: string, originalInput: string) {
  return z
    .object({
      description: z.string().trim().min(1, 'Required').max(4000),
      notes: z.string().max(4000),
      noDate: z.boolean(),
      scheduledAt: z.string(),
      // Client shape (until is a Date); the API layer converts it for requests.
      recurrence: z.custom<Recurrence | null>(),
      priority: PrioritySchema,
      categoryId: z.string().nullable(),
      leadMinutes: z.number().int().positive().nullable(),
    })
    .superRefine((v, ctx) => {
      if (v.noDate) return;
      const at = fromLocalInputValue(v.scheduledAt, tz);
      if (!at) {
        ctx.addIssue({
          code: 'custom',
          path: ['scheduledAt'],
          message: v.scheduledAt ? 'Invalid date/time' : 'Pick a time',
        });
        return;
      }
      if (v.scheduledAt !== originalInput && at.getTime() <= Date.now()) {
        ctx.addIssue({
          code: 'custom',
          path: ['scheduledAt'],
          message: 'Pick a time in the future',
        });
      }
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

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const LEAD_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'At the time' },
  { value: 5, label: '5 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
];

const SOURCE_LABEL: Record<Task['source']['type'], string> = {
  text: 'Created from a chat message',
  voice: 'Created from voice',
  forward: 'Created from a forwarded message',
  miniapp: 'Created in the app',
};

/** Show "Snoozed N times" from this many snoozes/delays on. */
const SNOOZE_NOTICE = 3;

const LABEL =
  'font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]';
const FIELD =
  'rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 font-sans text-[15px] text-[color:var(--color-text)] focus:border-[color:var(--color-accent)] focus:outline-none disabled:opacity-60';
const CHIP =
  'whitespace-nowrap rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] px-3 py-2 font-sans text-[12px] text-[color:var(--color-text-2)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50';

interface TaskEditFormProps {
  task: Task;
}

export function TaskEditForm({ task }: TaskEditFormProps) {
  const navigate = useNavigate();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const snooze = useSnoozeTask();
  const categories = useCategories();
  const haptic = useHapticFeedback();
  const tz = useUserTimezone();

  const isCompleted = task.status === 'completed';
  const isPending = task.status === 'pending';
  const when = fireAt(task);

  const originalInput = useMemo(
    () => (task.scheduledAt ? toLocalInputValue(task.scheduledAt, tz) : ''),
    [task.scheduledAt, tz],
  );
  const schema = useMemo(
    () => buildSchema(tz, originalInput),
    [tz, originalInput],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid, dirtyFields },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      description: task.description,
      notes: task.notes ?? '',
      noDate: task.scheduledAt === null,
      scheduledAt: originalInput,
      recurrence: task.recurrence ?? null,
      priority: task.priority,
      categoryId: task.categoryId,
      leadMinutes: task.leadMinutes,
    },
  });

  const recurrence = watch('recurrence');
  const scheduledInput = watch('scheduledAt');
  const noDate = watch('noDate');
  const priority = watch('priority');
  const categoryId = watch('categoryId');
  const leadMinutes = watch('leadMinutes');

  const isOverdue = isPending && when !== null && when.getTime() < Date.now();
  const keptPastTime = isOverdue && scheduledInput === originalInput;
  const anyPending =
    update.isPending ||
    remove.isPending ||
    complete.isPending ||
    reopen.isPending ||
    snooze.isPending;

  const goHome = () => {
    haptic.notify('success');
    navigate('/', { replace: true });
  };

  const onSubmit = handleSubmit((data) => {
    // Send only what changed: an unchanged time must not clear a snooze, and
    // an unchanged recurrence must not be re-anchored on the server.
    const patch: TaskPatch = {};
    if (dirtyFields.description) patch.description = data.description;
    if (dirtyFields.notes) patch.notes = data.notes.trim() || null;
    if (dirtyFields.priority) patch.priority = data.priority;
    if (dirtyFields.categoryId) patch.categoryId = data.categoryId;

    if (data.noDate) {
      if (task.scheduledAt !== null) patch.scheduledAt = null;
    } else {
      if (dirtyFields.scheduledAt || task.scheduledAt === null) {
        const at = fromLocalInputValue(data.scheduledAt, tz);
        if (!at) return;
        patch.scheduledAt = at;
      }
      if (dirtyFields.recurrence) patch.recurrence = data.recurrence;
      if (dirtyFields.leadMinutes) patch.leadMinutes = data.leadMinutes;
    }

    if (Object.keys(patch).length === 0) {
      navigate('/', { replace: true });
      return;
    }

    haptic.impact('medium');
    update.mutate(
      { id: task.id, patch },
      { onSuccess: goHome, onError: () => haptic.notify('error') },
    );
  });

  const fillPreset = (preset: Preset) => {
    setValue('scheduledAt', toLocalInputValue(preset.compute(new Date(), tz), tz), {
      shouldDirty: true,
      shouldValidate: true,
    });
    haptic.selection();
  };

  const snoozeTo = (preset: Preset) => {
    haptic.impact('light');
    snooze.mutate(
      { id: task.id, until: preset.compute(new Date(), tz) },
      { onSuccess: goHome, onError: () => haptic.notify('error') },
    );
  };

  useMainButton(
    isCompleted
      ? {
          text: reopen.isPending ? 'Reopening…' : 'Reopen',
          enabled: !anyPending,
          loading: reopen.isPending,
          onClick: () => {
            haptic.impact('medium');
            reopen.mutate(task.id, {
              onSuccess: goHome,
              onError: () => haptic.notify('error'),
            });
          },
        }
      : {
          text: update.isPending ? 'Saving…' : 'Save changes',
          enabled: isDirty && isValid && !anyPending,
          loading: update.isPending,
          onClick: () => void onSubmit(),
        },
  );

  const mutationError =
    update.error ?? snooze.error ?? reopen.error ?? complete.error ?? remove.error;

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-1 flex-col gap-4"
    >
      {(isOverdue || task.snoozedUntil || isCompleted) && (
        <div className="rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-2.5 font-sans text-xs text-[color:var(--color-text-2)]">
          {isCompleted && (
            <p>
              Completed
              {task.completedAt && (
                <>
                  {' '}
                  <span className="tabular-nums text-[color:var(--color-text)]">
                    {formatDayShort(task.completedAt, tz)} ·{' '}
                    {formatTime(task.completedAt, tz)}
                  </span>
                </>
              )}
              . Reopen it to edit.
            </p>
          )}
          {task.snoozedUntil && !isCompleted && (
            <p>
              Snoozed until{' '}
              <span className="tabular-nums text-[color:var(--color-text)]">
                {formatTime(task.snoozedUntil, tz)}
              </span>
              {task.recurrence ? ' (this occurrence only)' : ''}
            </p>
          )}
          {isOverdue && when && (
            <p className="text-[color:var(--color-danger)]">
              {relativeToNow(when)}
              {keptPastTime ? ' — snooze it, pick a new time or mark it done' : ''}
            </p>
          )}
        </div>
      )}

      <fieldset disabled={isCompleted} className="contents">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>What</span>
          <textarea
            rows={2}
            {...register('description')}
            className={`resize-none leading-snug tracking-tight ${FIELD}`}
            onBlur={() => window.scrollTo(0, 0)}
          />
          {errors.description && (
            <span className="font-sans text-xs text-[color:var(--color-danger)]">
              {errors.description.message}
            </span>
          )}
        </label>

        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-2">
            <span className="font-sans text-[15px] text-[color:var(--color-text)]">
              No date — keep in Inbox
            </span>
            <input
              type="checkbox"
              {...register('noDate')}
              className="h-5 w-5 accent-[color:var(--color-accent)]"
            />
          </label>

          {!noDate && (
            <label className="flex flex-col gap-1">
              <span className={LABEL}>When · {tz}</span>
              <input
                type="datetime-local"
                {...register('scheduledAt')}
                className={`tabular-nums ${FIELD}`}
                onBlur={() => window.scrollTo(0, 0)}
              />
              {errors.scheduledAt && (
                <span className="font-sans text-xs text-[color:var(--color-danger)]">
                  {errors.scheduledAt.message}
                </span>
              )}
              {/* A todo being scheduled: the chips fill the field. A reminder
                  gets its own Snooze row below, which acts immediately. */}
              {task.scheduledAt === null && (
                <PresetRow presets={PRESETS} onPick={fillPreset} disabled={anyPending} />
              )}
            </label>
          )}
        </div>

        {!noDate && (
          <>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Repeat</span>
              <RecurrencePicker
                value={recurrence ?? null}
                onChange={(next) => {
                  setValue('recurrence', next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  haptic.selection();
                }}
                disabled={anyPending || isCompleted}
              />
            </div>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Remind me</span>
              <select
                value={leadMinutes === null ? '' : String(leadMinutes)}
                onChange={(e) => {
                  setValue(
                    'leadMinutes',
                    e.target.value === '' ? null : Number(e.target.value),
                    { shouldDirty: true, shouldValidate: true },
                  );
                  haptic.selection();
                }}
                className={FIELD}
              >
                {withCurrentLead(leadMinutes).map((opt) => (
                  <option key={opt.label} value={opt.value === null ? '' : opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="flex flex-col gap-1">
          <span className={LABEL}>Priority</span>
          <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-2)] p-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={priority === p.value}
                onClick={() => {
                  setValue('priority', p.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  haptic.selection();
                }}
                className={`min-h-10 rounded-[14px] font-sans text-[13px] font-medium transition ${
                  priority === p.value
                    ? p.value === 'high'
                      ? 'bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]'
                      : 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-sm'
                    : 'text-[color:var(--color-text-2)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL}>Category</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={categoryId === null}
              onClick={() => {
                setValue('categoryId', null, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                haptic.selection();
              }}
              className={`${CHIP} ${categoryId === null ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : ''}`}
            >
              None
            </button>
            {(categories.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => {
                  setValue('categoryId', c.id, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  haptic.selection();
                }}
                className="rounded-[var(--radius-pill)] disabled:opacity-50"
              >
                <CategoryChip category={c} size="md" selected={categoryId === c.id} />
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Notes</span>
          <textarea
            rows={3}
            placeholder="Anything worth remembering about this…"
            {...register('notes')}
            className={`resize-none text-[14px] leading-snug ${FIELD}`}
            onBlur={() => window.scrollTo(0, 0)}
          />
        </label>
      </fieldset>

      {isPending && task.scheduledAt !== null && (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Snooze until</span>
          <PresetRow presets={PRESETS} onPick={snoozeTo} disabled={anyPending} />
        </div>
      )}

      <SourceLine task={task} />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {isPending && (
          <button
            type="button"
            onClick={() => {
              haptic.impact('medium');
              complete.mutate(task.id, {
                onSuccess: goHome,
                onError: () => haptic.notify('error'),
              });
            }}
            disabled={anyPending}
            className="min-h-11 rounded-[var(--radius-big)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] px-4 py-3 font-sans text-sm font-medium text-[color:var(--color-accent)] transition disabled:opacity-60"
          >
            {complete.isPending
              ? 'Marking…'
              : task.recurrence
                ? 'Mark this time as done'
                : 'Mark as done'}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            haptic.impact('heavy');
            remove.mutate(task.id, { onSuccess: goHome });
          }}
          disabled={anyPending}
          className="min-h-11 rounded-[var(--radius-big)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-4 py-3 font-sans text-sm font-medium text-[color:var(--color-danger)] transition disabled:opacity-60"
        >
          {remove.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {mutationError && (
        <div className="rounded-[var(--radius-card)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-3">
          <p className="font-sans text-xs text-[color:var(--color-danger)]">
            {mutationError instanceof Error
              ? mutationError.message
              : 'Something went wrong.'}
          </p>
        </div>
      )}
    </form>
  );
}

/** Keeps a custom lead time (set from chat) selectable next to the presets. */
function withCurrentLead(current: number | null) {
  if (current === null || LEAD_OPTIONS.some((o) => o.value === current)) {
    return LEAD_OPTIONS;
  }
  return [...LEAD_OPTIONS, { value: current, label: `${current} min before` }];
}

function PresetRow({
  presets,
  onPick,
  disabled,
}: {
  presets: Preset[];
  onPick: (preset: Preset) => void;
  disabled: boolean;
}) {
  return (
    <div className="-mx-4 mt-1 overflow-x-auto px-4">
      <div className="flex w-max gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onPick(preset)}
            disabled={disabled}
            className={CHIP}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SourceLine({ task }: { task: Task }) {
  const { source } = task;
  const from = source.forwardedFrom ? ` · ${source.forwardedFrom}` : '';
  return (
    <div className="rounded-[var(--radius-card)] bg-[color:var(--color-surface-2)] px-4 py-2.5 font-sans text-xs text-[color:var(--color-text-2)]">
      <p>
        {SOURCE_LABEL[source.type]}
        {from}
        {task.recurrence && task.completionsCount > 0
          ? ` · done ${task.completionsCount}×`
          : ''}
      </p>
      {source.originalText && source.originalText !== task.description && (
        <p className="mt-0.5 italic text-[color:var(--color-text-3)]">
          “{source.originalText}”
        </p>
      )}
      {task.snoozeCount >= SNOOZE_NOTICE && (
        // Same signal the bot's weekly wrap gives: maybe it needs a real slot.
        <p className="mt-0.5 text-[color:var(--color-text-3)]">
          Snoozed {task.snoozeCount} times
        </p>
      )}
    </div>
  );
}
