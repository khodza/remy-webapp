import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { TaskEditForm, useTask } from '@/features/reminders';
import { Page } from '@/shared/ui';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const task = useTask(id);

  return (
    <Page>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Edit reminder
          </h1>
        </header>

        {task.isPending ? (
          <div className="flex items-center justify-center gap-2 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text-2)]">
            <Loader2 size={16} className="animate-spin" />
            <span className="font-sans text-sm">Loading…</span>
          </div>
        ) : task.isError || !task.data ? (
          <div className="rounded-[var(--radius-big)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-4">
            <p className="font-sans text-sm text-[color:var(--color-danger)]">
              {task.error instanceof Error
                ? task.error.message
                : 'Task not found.'}
            </p>
          </div>
        ) : (
          <TaskEditForm task={task.data} />
        )}
      </main>
    </Page>
  );
}
