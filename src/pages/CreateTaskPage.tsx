import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreateTaskForm,
  VoiceRecordButton,
} from '@/features/reminders';
import { Page } from '@/shared/ui';

export function CreateTaskPage() {
  const navigate = useNavigate();
  const [voiceError, setVoiceError] = useState<string | null>(null);

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

        <section className="rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
          <VoiceRecordButton
            onCreated={() => navigate('/', { replace: true })}
            onError={(message) => setVoiceError(message)}
          />
          {voiceError && (
            <p className="mt-3 font-sans text-xs text-[color:var(--color-danger)]">
              {voiceError}
            </p>
          )}
        </section>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--color-hairline)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-3)]">
            or type it
          </span>
          <span className="h-px flex-1 bg-[color:var(--color-hairline)]" />
        </div>

        <CreateTaskForm />
      </main>
    </Page>
  );
}
