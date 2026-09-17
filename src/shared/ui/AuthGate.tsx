import { useQueryClient } from '@tanstack/react-query';
import { Lock, RefreshCw } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';

/**
 * Replaces raw backend messages with one explanation when the app cannot
 * log in at all: expired/rejected initData (reopen from the bot) or a
 * private bot refusing this user. Everything else renders normally.
 */
export function AuthGate({ children }: PropsWithChildren) {
  const failure = useAuthStore((s) => s.failure);
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  if (!failure) return <>{children}</>;

  const retry = async () => {
    setRetrying(true);
    try {
      useAuthStore.getState().clear();
      await useAuthStore.getState().authenticate();
      await qc.invalidateQueries();
    } catch {
      // failure state is updated by the store; nothing else to do
    } finally {
      setRetrying(false);
    }
  };

  const forbidden = failure === 'forbidden';
  const title = forbidden ? 'This bot is private' : 'Session expired';
  const body = forbidden
    ? 'Remy only answers its owner. If that is you, check OWNER_TELEGRAM_ID on the server.'
    : failure === 'no-init-data'
      ? 'Telegram did not pass a login. Open Remy from the bot’s menu button.'
      : 'Your Telegram login is too old for the server to accept. Close this window and reopen Remy from the bot.';

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: 'var(--color-accent-soft)',
          color: 'var(--color-accent)',
        }}
      >
        <Lock size={24} />
      </span>
      <h1 className="font-sans text-xl font-bold tracking-tight text-[color:var(--color-text)]">
        {title}
      </h1>
      <p className="max-w-[32ch] font-sans text-sm text-[color:var(--color-text-2)]">
        {body}
      </p>
      {!forbidden && (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] bg-[color:var(--color-accent)] px-5 font-sans text-sm font-semibold text-[color:var(--color-accent-fg)] transition disabled:opacity-60"
        >
          <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </main>
  );
}
