import { Check, Flag, Loader2, Repeat, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  recurrenceLabel,
  useCompleteTask,
  useDeleteTask,
  useTasks,
} from '@/features/reminders';
import { CategoryChip, useCategoryMap } from '@/features/categories';
import type { Category, Task } from '@/shared/api';
import {
  fireAt,
  formatInTz,
  formatTime,
  isTodayInTz,
  isTomorrowInTz,
  startOfDayInTz,
  useUserTimezone,
} from '@/shared/lib/dates';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { Page } from '@/shared/ui';

/** A pending reminder with a known fire time (todos never appear here). */
interface Timed {
  task: Task;
  when: Date;
}

interface DayGroup {
  key: string;
  label: string;
  sublabel: string;
  isToday: boolean;
  items: Timed[];
}

function groupByDay(tasks: Task[], tz: string): DayGroup[] {
  const pending: Timed[] = [];
  for (const task of tasks) {
    const when = fireAt(task);
    if (task.status !== 'pending' || task.isOverdue || when === null) continue;
    pending.push({ task, when });
  }
  pending.sort((a, b) => a.when.getTime() - b.when.getTime());

  const groups: DayGroup[] = [];
  for (const item of pending) {
    const { when } = item;
    const key = formatInTz(startOfDayInTz(when, tz), tz, 'yyyy-MM-dd');
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.push({
      key,
      label: labelForDay(when, tz),
      sublabel: formatInTz(when, tz, 'EEE, d MMM'),
      isToday: isTodayInTz(when, tz),
      items: [item],
    });
  }
  return groups;
}

function labelForDay(date: Date, tz: string): string {
  if (isTodayInTz(date, tz)) return 'Today';
  if (isTomorrowInTz(date, tz)) return 'Tomorrow';
  return formatInTz(date, tz, 'EEEE');
}

export function UpcomingPage() {
  const navigate = useNavigate();
  // Same query as Home, so the two screens share one cache entry.
  const tasksQuery = useTasks({});
  const categories = useCategoryMap();
  const complete = useCompleteTask();
  const remove = useDeleteTask();
  const haptic = useHapticFeedback();
  const tz = useUserTimezone();

  const groups = useMemo(
    () => groupByDay(tasksQuery.data ?? [], tz),
    [tasksQuery.data, tz],
  );
  const busy = complete.isPending || remove.isPending;

  return (
    <Page>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Upcoming
          </h1>
          <p className="mt-1 font-sans text-sm text-[color:var(--color-text-2)]">
            Everything on the horizon, grouped by day.
          </p>
        </header>

        {tasksQuery.isPending ? (
          <LoadingState />
        ) : tasksQuery.isError ? (
          <ErrorState
            message={
              tasksQuery.error instanceof Error
                ? tasksQuery.error.message
                : 'Something went wrong.'
            }
          />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map((group) => (
            <DaySection
              key={group.key}
              group={group}
              tz={tz}
              categories={categories}
              busy={busy}
              onComplete={(id) => {
                haptic.impact('light');
                complete.mutate(id);
              }}
              onDelete={(id) => {
                haptic.impact('medium');
                remove.mutate(id);
              }}
              onOpen={(id) => navigate(`/tasks/${id}`)}
            />
          ))
        )}
      </main>
    </Page>
  );
}

function DaySection({
  group,
  tz,
  categories,
  busy,
  onComplete,
  onDelete,
  onOpen,
}: {
  group: DayGroup;
  tz: string;
  categories: Map<string, Category>;
  busy: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const isGroupToday = group.isToday;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-2">
        <span
          className="font-sans text-[13px] font-semibold tracking-tight"
          style={{
            color: isGroupToday
              ? 'var(--color-accent)'
              : 'var(--color-text)',
          }}
        >
          {group.label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[color:var(--color-text-2)]">
          {group.sublabel}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {group.items.map(({ task, when }) => (
          <UpcomingRow
            key={task.id}
            task={task}
            when={when}
            tz={tz}
            category={
              task.categoryId ? categories.get(task.categoryId) : undefined
            }
            disabled={busy}
            onComplete={() => onComplete(task.id)}
            onDelete={() => onDelete(task.id)}
            onOpen={() => onOpen(task.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function UpcomingRow({
  task,
  when,
  tz,
  category,
  disabled,
  onComplete,
  onDelete,
  onOpen,
}: {
  task: Task;
  when: Date;
  tz: string;
  category: Category | undefined;
  disabled: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const repeat = recurrenceLabel(task.recurrence);
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
      <button
        type="button"
        onClick={onComplete}
        disabled={disabled}
        aria-label="Mark complete"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[color:var(--color-text-3)] transition disabled:opacity-50"
      >
        <Check size={12} className="text-transparent" strokeWidth={3} />
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate font-sans text-[15px] leading-snug tracking-tight text-[color:var(--color-text)]">
          {task.priority === 'high' && (
            <Flag
              size={13}
              aria-label="High priority"
              className="mr-1 inline-block -translate-y-px text-[color:var(--color-danger)]"
              fill="currentColor"
            />
          )}
          {task.description}
        </p>
        {(repeat || category) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {category && <CategoryChip category={category} />}
            {repeat && (
              <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[color:var(--color-text-2)]">
                <Repeat size={11} />
                {repeat}
              </span>
            )}
          </span>
        )}
      </button>

      <span className="shrink-0 text-right">
        <span className="block font-mono text-[12px] tabular-nums text-[color:var(--color-accent)]">
          {formatTime(when, tz)}
        </span>
        {task.snoozedUntil && (
          <span className="block font-sans text-[10px] text-[color:var(--color-text-3)]">
            snoozed
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete"
        className="shrink-0 text-[color:var(--color-text-3)] transition hover:text-[color:var(--color-danger)] disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text-2)]">
      <Loader2 size={16} className="animate-spin" />
      <span className="font-sans text-sm">Loading…</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-center">
      <p className="font-sans text-sm text-[color:var(--color-text-2)]">
        Nothing scheduled ahead. Tap + on Home to add a reminder.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-big)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-4">
      <p className="font-sans text-sm text-[color:var(--color-danger)]">
        {message}
      </p>
    </div>
  );
}
