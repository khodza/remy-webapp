import { ErrorBoundary } from '@/app/ErrorBoundary';
import { Providers } from '@/app/Providers';
import { Router } from '@/app/Router';
import { useEnsureTimezone } from '@/features/profile';

function ErrorFallback({ error }: { error: unknown }) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-sans text-sm text-[color:var(--color-text-2)]">
        Something went wrong.
      </p>
      <code className="font-mono text-xs text-[color:var(--color-danger)]">
        {message}
      </code>
    </div>
  );
}

function TimezoneBootstrap() {
  useEnsureTimezone();
  return null;
}

export function Root() {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <Providers>
        <TimezoneBootstrap />
        <Router />
      </Providers>
    </ErrorBoundary>
  );
}
