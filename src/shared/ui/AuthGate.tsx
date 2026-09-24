import { useQueryClient } from '@tanstack/react-query';
import { Lock, RefreshCw } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';
import { Button } from './Button';
import { Placeholder } from './Empty';

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
    <Placeholder
      icon={<Lock size={24} />}
      title={title}
      body={body}
      action={
        forbidden ? undefined : (
          <Button
            variant="primary"
            onClick={() => void retry()}
            disabled={retrying}
            icon={<RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />}
          >
            {retrying ? 'Retrying…' : 'Try again'}
          </Button>
        )
      }
    />
  );
}
