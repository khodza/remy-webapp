import { Page } from '@/shared/ui';
import { useTelegramUser } from '@/shared/lib/telegram';

export function HomePage() {
  const user = useTelegramUser();

  return (
    <Page back={false}>
      <main className="flex flex-1 flex-col px-4 py-6">
        <header className="mb-4">
          <p className="font-sans text-sm text-[color:var(--color-text-2)]">
            {user ? `Hi, ${user.firstName}` : 'Hi there'}
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Remy is <em className="not-italic text-[color:var(--color-accent)]">warming up</em>
          </h1>
        </header>

        <section className="rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
          <p className="font-sans text-sm leading-relaxed text-[color:var(--color-text-2)]">
            Scaffold is live. Feature screens (Today, Timeline, Create, Settings, etc.) will land
            as the backend HTTP API ships.
          </p>
        </section>
      </main>
    </Page>
  );
}
