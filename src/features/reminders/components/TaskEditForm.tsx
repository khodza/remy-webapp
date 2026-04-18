import { zodResolver } from '@hookform/resolvers/zod';
import {
  addDays,
  addHours,
  format,
  nextMonday,
  nextSaturday,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { Task } from '@/shared/api';
import { useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import { useDeleteTask, useUpdateTask } from '../hooks';

const schema = z.object({
  description: z.string().min(1, 'Required').max(4000),
  scheduledAt: z
    .string()
    .min(1, 'Required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date/time'),
});

type FormValues = z.infer<typeof schema>;

function toLocalInputValue(date: Date): string {
  // <input type="datetime-local"> expects YYYY-MM-DDTHH:mm in *local* time.
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

interface Preset {
  key: string;
  label: string;
  compute: (now: Date) => Date;
}

const atTime = (date: Date, hour: number, minute = 0): Date =>
  setSeconds(setMinutes(setHours(date, hour), minute), 0);

const PRESETS: Preset[] = [
  {
    key: 'in-1-hour',
    label: '+1 hour',
    compute: (now) => addHours(now, 1),
  },
  {
    key: 'tonight',
    label: 'Tonight 8pm',
    compute: (now) => {
      const tonight = atTime(now, 20);
      return tonight.getTime() > now.getTime()
        ? tonight
        : atTime(addDays(startOfDay(now), 1), 20);
    },
  },
  {
    key: 'tomorrow-9am',
    label: 'Tomorrow 9am',
    compute: (now) => atTime(addDays(startOfDay(now), 1), 9),
  },
  {
    key: 'weekend',
    label: 'Weekend 10am',
    compute: (now) => atTime(nextSaturday(now), 10),
  },
  {
    key: 'next-monday',
    label: 'Next Monday 9am',
    compute: (now) => atTime(nextMonday(now), 9),
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
      scheduledAt: toLocalInputValue(task.scheduledAt),
    },
  });

  const values = watch();

  const onSubmit = handleSubmit((data) => {
    haptic.impact('medium');
    update.mutate(
      {
        id: task.id,
        patch: {
          description: data.description,
          scheduledAt: new Date(data.scheduledAt),
        },
      },
      {
        onSuccess: () => {
          haptic.notify('success');
          navigate('/');
        },
        onError: () => haptic.notify('error'),
      },
    );
  });

  const applyPreset = (preset: Preset) => {
    const next = preset.compute(new Date());
    setValue('scheduledAt', toLocalInputValue(next), {
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

  useEffect(() => {
    // Preview — compiler would strip if unused
    void values;
  }, [values]);

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-1 flex-col gap-4"
    >
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
          When
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

      <button
        type="button"
        onClick={() => {
          haptic.impact('heavy');
          remove.mutate(task.id, {
            onSuccess: () => {
              haptic.notify('success');
              navigate('/');
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
