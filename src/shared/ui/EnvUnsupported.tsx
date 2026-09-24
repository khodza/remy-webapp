import { isTMA } from '@telegram-apps/sdk-react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { useLayoutEffect, useMemo } from 'react';
import { Button } from './Button';
import { Placeholder } from './Empty';

interface EnvUnsupportedProps {
  error?: string;
}

/**
 * Rendered when bootstrap throws. Outside Telegram that means "open it from
 * the bot"; inside Telegram it is a real startup failure and the user needs
 * a way to retry, not advice they are already following (F10).
 */
export function EnvUnsupported({ error }: EnvUnsupportedProps) {
  const insideTelegram = useMemo(() => {
    try {
      return isTMA();
    } catch {
      return false;
    }
  }, []);

  // The SDK never initialised, so follow the OS scheme for colours.
  useLayoutEffect(() => {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, []);

  const showError = Boolean(error) && import.meta.env.DEV;

  return (
    <>
      {insideTelegram ? (
        <Placeholder
          icon={<RefreshCw size={24} />}
          title="Something went wrong starting Remy"
          body="Please try again. If it keeps happening, close the app and reopen it from the bot."
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Placeholder
          icon={<MessageCircle size={24} />}
          title="Open in Telegram"
          body="Remy runs inside Telegram. Open it from the Remy bot to continue."
        />
      )}
      {showError && (
        <pre className="mx-4 my-2 whitespace-pre-wrap break-words rounded-xl bg-danger-soft px-4 py-3 font-mono text-[11px] text-danger">
          {error}
        </pre>
      )}
    </>
  );
}
