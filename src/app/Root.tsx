import { ErrorBoundary } from '@/app/ErrorBoundary';
import { Providers } from '@/app/Providers';
import { Router } from '@/app/Router';
import { RefreshCw } from 'lucide-react';
import { useEnsureTimezone } from '@/features/profile';
import { useClockFormatSync } from '@/features/settings';
import { Button, Placeholder } from '@/shared/ui';

function ErrorFallback({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);

  return (
    <Placeholder
      icon={<RefreshCw size={24} />}
      title="Something went wrong"
      body={import.meta.env.DEV ? message : 'Close Remy and open it again from the bot.'}
      action={
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      }
    />
  );
}

/** Profile zone detection and the 12/24-hour preference, once per app. */
function Bootstrap() {
  useEnsureTimezone();
  useClockFormatSync();
  return null;
}

export function Root() {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <Providers>
        <Bootstrap />
        <Router />
      </Providers>
    </ErrorBoundary>
  );
}
