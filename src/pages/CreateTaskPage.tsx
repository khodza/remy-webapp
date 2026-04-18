import { CreateTaskForm } from '@/features/reminders/components/CreateTaskForm';
import { Page } from '@/shared/ui';

export function CreateTaskPage() {
  return (
    <Page>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            New reminder
          </h1>
          <p className="mt-1 font-sans text-sm text-[color:var(--color-text-2)]">
            Type naturally — Remy parses the time for you.
          </p>
        </header>
        <CreateTaskForm />
      </main>
    </Page>
  );
}
