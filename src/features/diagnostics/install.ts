import { ApiError, onApiFailure, reportClientError, type ApiFailure } from '@/shared/api';
import { useAuthStore } from '@/shared/stores/auth.store';
import { createErrorReporter, describeError, routeFromHash, type ErrorReporter } from './reporter';

let reporter: ErrorReporter | null = null;

function currentReporter(): ErrorReporter {
  if (!reporter) {
    reporter = createErrorReporter({
      // Only a logged-in app can post a report; before that they are
      // dropped, never queued (a report must never start an initData exchange).
      send: async (body) => {
        if (!useAuthStore.getState().token) return;
        await reportClientError(body);
      },
      appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined,
      userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
    });
  }
  return reporter;
}

function route(): string {
  return typeof window === 'undefined' ? '/' : routeFromHash(window.location.hash);
}

/** An error the render tree could not recover from (ErrorBoundary). */
export function reportRenderError(error: unknown, componentStack?: string | null): void {
  const { message, stack } = describeError(error);
  currentReporter().report({
    message,
    kind: 'render',
    stack: [stack, componentStack ? `Component stack:${componentStack}` : null].filter(Boolean).join('\n') || undefined,
    url: route(),
  });
}

/** Network errors and 5xx from apiRequest (4xx are never reported). */
function reportApiFailure({ method, path, error }: ApiFailure): void {
  const status = error.status === 0 ? 'network error' : `${error.status} ${error.code}`;
  currentReporter().report({
    message: `${method} ${path.split('?')[0]} → ${status}: ${error.message}`,
    kind: 'api',
    url: route(),
  });
}

/**
 * window.onerror, unhandled promise rejections and failed API calls go to
 * POST /client-errors (plan 6.2), rate-limited and deduped on the client,
 * with the app version and route, never initData or a token. Installed
 * once at boot; returns the uninstaller (tests).
 */
export function installErrorReporting(): () => void {
  const onError = (event: ErrorEvent) => {
    const { message, stack } = describeError(event.error ?? event.message);
    currentReporter().report({
      message: event.filename ? `${message} (${event.filename}:${event.lineno}:${event.colno})` : message,
      kind: 'error',
      stack,
      url: route(),
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    // A cancelled request is not an error; a 4xx is the caller's business
    // (and 401/403/404 are never reported).
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    if (reason instanceof ApiError && reason.status !== 0 && reason.status < 500) return;
    const { message, stack } = describeError(reason);
    currentReporter().report({ message, kind: 'unhandledrejection', stack, url: route() });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const offApi = onApiFailure(reportApiFailure);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    offApi();
  };
}

/** Tests: a fresh reporter with its own budget. */
export function resetErrorReporter(): void {
  reporter = null;
}
