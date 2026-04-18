import { useAuthStore } from '@/shared/stores/auth.store';

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

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
}

export function buildUrl(
  path: string,
  query?: RequestOptions['query'],
): string {
  const url = new URL(
    path.startsWith('/') ? path.slice(1) : path,
    ensureTrailingSlash(BASE_URL),
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await useAuthStore.getState().authenticate();
  const response = await tryFetch(method, path, options, token);

  if (response.status === 401) {
    // Token invalid/expired — re-exchange once and retry
    useAuthStore.getState().clear();
    const fresh = await useAuthStore.getState().authenticate();
    const retry = await tryFetch(method, path, options, fresh);
    return parseResponse<T>(retry);
  }

  return parseResponse<T>(response);
}

async function tryFetch(
  method: string,
  path: string,
  options: RequestOptions,
  bearerToken: string,
): Promise<Response> {
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
    const message =
      err instanceof Error ? err.message : 'Network error';
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
      extractStringField(body, 'message') ??
        response.statusText ??
        'Request failed',
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

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
