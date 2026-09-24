import { useAuthStore } from '@/shared/stores/auth.store';

// Default: relative path. In dev, Vite's server.proxy forwards /api/* to the
// local backend, so the Mini App stays same-origin whether it's running on
// localhost:5173 or a *.trycloudflare.com tunnel. Override to an absolute URL
// in production (.env) to point at a separately-deployed API.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** A failure of this request is not reported (the error report itself). */
  silent?: boolean;
}

export interface ApiFailure {
  method: string;
  path: string;
  error: ApiError;
}

type FailureListener = (failure: ApiFailure) => void;
const failureListeners = new Set<FailureListener>();

/**
 * Called for every request that ends in a network error or a server error
 * (5xx); client errors (4xx) are the caller's business. The diagnostics
 * feature subscribes to send them to POST /client-errors.
 */
export function onApiFailure(listener: FailureListener): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

function notifyFailure(method: string, path: string, error: ApiError): void {
  if (error.status !== 0 && error.status < 500) return;
  for (const listener of failureListeners) {
    try {
      listener({ method, path, error });
    } catch {
      // a broken listener must not break the request's own error path
    }
  }
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${pathPart}`;

  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(method, path, options);
  } catch (err) {
    if (err instanceof ApiError && !options.silent) notifyFailure(method, path, err);
    throw err;
  }
}

async function send<T>(method: string, path: string, options: RequestOptions): Promise<T> {
  const token = await useAuthStore.getState().authenticate();
  const response = await tryFetch(method, path, options, token);

  if (response.status === 401) {
    // The token was rejected: refresh it once, else re-exchange initData,
    // then retry once. If another request already replaced the token while
    // this one was in flight, that one is reused.
    const fresh = await useAuthStore.getState().recover(token);
    const retry = await tryFetch(method, path, options, fresh);
    return parseResponse<T>(retry);
  }

  return parseResponse<T>(response);
}

async function tryFetch(method: string, path: string, options: RequestOptions, bearerToken: string): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
  };
  const hasBody = options.body !== undefined;
  if (hasBody) headers['Content-Type'] = 'application/json';

  const init: RequestInit = {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  try {
    return await fetch(buildUrl(path, options.query), init);
  } catch (err) {
    // A cancelled request is not a network failure: let the AbortError
    // through so React Query treats it as a cancellation.
    if (options.signal?.aborted) throw err;
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(0, 'NETWORK_ERROR', message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(
      response.status,
      extractStringField(body, 'error') ?? 'ERROR',
      extractStringField(body, 'message') ?? response.statusText ?? 'Request failed',
    );
  }

  return (await response.json()) as T;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractStringField(body: unknown, key: string): string | undefined {
  if (body && typeof body === 'object' && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}
