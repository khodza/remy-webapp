import { Check, Loader2, Plus, Settings2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  useCompleteTask,
  useDeleteTask,
  useTasks,
} from '@/features/reminders';
import type { Task } from '@/shared/api';
import { useHapticFeedback, useTelegramUser } from '@/shared/lib/telegram';
import { Page } from '@/shared/ui';

const VARS = { includeCompleted: true } as const;

interface Groups {
  overdue: Task[];
  later: Task[];
  completed: Task[];
}

function groupTasks(tasks: Task[]): Groups {
  const overdue: Task[] = [];
  const later: Task[] = [];
  const completed: Task[] = [];
  for (const task of tasks) {
    if (task.status === 'completed') completed.push(task);
    else if (task.isOverdue) overdue.push(task);
    else later.push(task);
  }
  return { overdue, later, completed };
}

export function HomePage() {
  const navigate = useNavigate();
  const user = useTelegramUser();
  const tasksQuery = useTasks(VARS);
  const complete = useCompleteTask(VARS);
  const remove = useDeleteTask(VARS);
  const haptic = useHapticFeedback();
  const [showCompleted, setShowCompleted] = useState(false);

  const groups = useMemo(
    () => groupTasks(tasksQuery.data ?? []),
    [tasksQuery.data],
  );
  const hasAny =
    groups.overdue.length + groups.later.length + groups.completed.length > 0;

  return (
    <Page back={false}>
      <main className="relative flex flex-1 flex-col gap-4 px-4 pb-24 pt-6">
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className="font-sans text-sm text-[color:var(--color-text-2)]">
              {user ? `Hi, ${user.firstName}` : 'Hi there'}
            </p>
            <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
              Today
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-text-2)] transition hover:bg-[color:var(--color-surface-2)]"
          >
            <Settings2 size={18} />
          </button>
        </header>

        <StatStrip
          overdue={groups.overdue.length}
          remaining={groups.later.length}
          done={groups.completed.length}
        />

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
        ) : !hasAny ? (
          <EmptyState />
        ) : (
          <>
            {groups.overdue.length > 0 && (
              <Section title="Overdue" tone="danger" count={groups.overdue.length}>
                <TaskList
                  tasks={groups.overdue}
                  disabled={complete.isPending || remove.isPending}
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
              </Section>
            )}

            {groups.later.length > 0 && (
              <Section title="Later" count={groups.later.length}>
                <TaskList
                  tasks={groups.later}
                  disabled={complete.isPending || remove.isPending}
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
              </Section>
            )}

            {groups.completed.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="flex w-full items-center justify-between px-2 py-2 font-mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-2)]"
                >
                  <span>Done</span>
                  <span className="tabular-nums">
                    {groups.completed.length}{' '}
                    {showCompleted ? '▾' : '▸'}
                  </span>
                </button>
                {showCompleted && (
                  <TaskList
                    tasks={groups.completed}
                    disabled={complete.isPending || remove.isPending}
                    onComplete={() => {}}
                    onDelete={(id) => {
                      haptic.impact('medium');
                      remove.mutate(id);
                    }}
                    onOpen={(id) => navigate(`/tasks/${id}`)}
                  />
                )}
              </section>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => {
            haptic.impact('light');
            navigate('/create');
          }}
          aria-label="New reminder"
          className="fixed bottom-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition active:scale-95"
          style={{ bottom: 'calc(1rem + var(--tg-safe-area-inset-bottom, 0px))' }}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </main>
    </Page>
  );
}

function StatStrip({
  overdue,
  remaining,
  done,
}: {
  overdue: number;
  remaining: number;
  done: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatCell label="Overdue" value={overdue} tone={overdue > 0 ? 'danger' : 'muted'} />
      <StatCell label="Remaining" value={remaining} tone="accent" />
      <StatCell label="Done" value={done} tone="muted" />
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'accent' | 'danger' | 'muted';
}) {
  const toneColor = {
    accent: 'var(--color-accent)',
    danger: 'var(--color-danger)',
    muted: 'var(--color-text-2)',
  }[tone];

  return (
    <div className="rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2.5">
      <p
        className="font-sans text-xl font-semibold tabular-nums tracking-tight"
        style={{ color: toneColor }}
      >
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
        {label}
      </p>
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  const color =
    tone === 'danger' ? 'var(--color-danger)' : 'var(--color-text-2)';
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-2">
        <span
          className="font-mono text-[11px] uppercase tracking-wider"
          style={{ color }}
        >
          {title}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[color:var(--color-text-3)]">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function TaskList({
  tasks,
  disabled,
  onComplete,
  onDelete,
  onOpen,
}: {
  tasks: Task[];
  disabled: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          disabled={disabled}
          onComplete={() => onComplete(task.id)}
          onDelete={() => onDelete(task.id)}
          onOpen={() => onOpen(task.id)}
        />
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  disabled,
  onComplete,
  onDelete,
  onOpen,
}: {
  task: Task;
  disabled: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const isDone = task.status === 'completed';
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
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

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
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
      </button>

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
        No reminders yet. Tap + to create one.
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
