import { Check, Loader2, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  useCompleteTask,
  useDeleteTask,
  useTasks,
} from '@/features/reminders';
import type { Task } from '@/shared/api';
import { useHapticFeedback, useTelegramUser } from '@/shared/lib/telegram';
import { Page } from '@/shared/ui';

export function HomePage() {
  const user = useTelegramUser();
  const tasksQuery = useTasks();
  const complete = useCompleteTask();
  const remove = useDeleteTask();
  const haptic = useHapticFeedback();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  return (
    <Page back={false}>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <header>
          <p className="font-sans text-sm text-[color:var(--color-text-2)]">
            {user ? `Hi, ${user.firstName}` : 'Hi there'}
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Today
          </h1>
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
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={complete.isPending || remove.isPending}
                onComplete={() => {
                  haptic.impact('light');
                  complete.mutate(task.id);
                }}
                onDelete={() => {
                  haptic.impact('medium');
                  remove.mutate(task.id);
                }}
              />
            ))}
          </ul>
        )}
      </main>
    </Page>
  );
}

function TaskRow({
  task,
  disabled,
  onComplete,
  onDelete,
}: {
  task: Task;
  disabled: boolean;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const isDone = task.status === 'completed';
  return (
    <li
      className="flex items-start gap-3 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3"
      data-overdue={task.isOverdue ? 'true' : undefined}
    >
      <button
        type="button"
        onClick={onComplete}
        disabled={disabled || isDone}
        aria-label={isDone ? 'Completed' : 'Mark complete'}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[color:var(--color-text-3)] transition disabled:opacity-50 data-[done=true]:border-[color:var(--color-accent)] data-[done=true]:bg-[color:var(--color-accent)]"
        data-done={isDone ? 'true' : undefined}
      >
        {isDone && <Check size={12} className="text-white" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`font-sans text-[15px] leading-snug tracking-tight text-[color:var(--color-text)] ${isDone ? 'text-[color:var(--color-text-3)] line-through' : ''}`}
        >
          {task.description}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-[3px] font-sans text-[11px] font-medium tabular-nums ${
              task.isOverdue
                ? 'bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]'
                : 'bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]'
            }`}
          >
            {format(task.scheduledAt, 'MMM d, h:mm a')}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete"
        className="shrink-0 text-[color:var(--color-text-3)] transition hover:text-[color:var(--color-danger)] disabled:opacity-50"
      >
        <Trash2 size={18} />
      </button>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text-2)]">
      <Loader2 size={16} className="animate-spin" />
      <span className="font-sans text-sm">Loading tasks…</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-center">
      <p className="font-sans text-sm text-[color:var(--color-text-2)]">
        No reminders yet. Send one to the Remy bot to get started.
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
