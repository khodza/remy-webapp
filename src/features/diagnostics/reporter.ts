import type { ClientErrorReport } from '@/shared/api';

export type ErrorKind = NonNullable<ClientErrorReport['kind']>;

export interface ErrorInput {
  message: string;
  kind: ErrorKind;
  stack?: string | undefined;
  /** The app route ("/tasks/64b…"), no query. */
  url?: string | undefined;
}

export interface ReporterOptions {
  send: (report: ClientErrorReport) => Promise<void>;
  /** Reports per minute, at most (the server allows 20; the client stays well under). */
  maxPerMinute?: number;
  /** The same message (and kind) is sent once per this window. */
  dedupeMs?: number;
  appVersion?: string | undefined;
  userAgent?: string | undefined;
  now?: () => number;
}

const MINUTE = 60_000;
const LIMITS = { message: 1000, stack: 8000, url: 2000, userAgent: 500, appVersion: 64 } as const;

/**
 * Anything that could be a credential is cut out before a report leaves:
 * the `tma` / `Bearer` authorization values, initData (`hash=`,
 * `tgWebAppData=`, `signature=`, `auth_date=`), JWT-looking strings.
 */
export function scrubSecrets(text: string): string {
  return text
    .replace(/\b(tma|Bearer)\s+[^\s'"]+/gi, '$1 [redacted]')
    .replace(/\b(hash|signature|tgWebAppData|auth_date|query_id)=[^&\s'"]*/gi, '$1=[redacted]')
    .replace(/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, '[jwt]')
    .replace(/\binitData(?:Raw)?\s*[:=]\s*[^\s,;]+/gi, 'initData=[redacted]');
}

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Builds and sends error reports with a client-side budget: identical
 * messages once per minute, at most `maxPerMinute` in any sliding minute,
 * secrets scrubbed, the sizes the contract allows. `report` says whether
 * it was sent; a failed send is swallowed (never an error about an error).
 */
export function createErrorReporter(options: ReporterOptions) {
  const { send, maxPerMinute = 5, dedupeMs = MINUTE, appVersion, userAgent, now = () => Date.now() } = options;
  const sentAt: number[] = [];
  const lastSeen = new Map<string, number>();

  function report(input: ErrorInput): boolean {
    const message = cut(scrubSecrets(input.message).trim(), LIMITS.message);
    if (!message) return false;
    const t = now();
    const key = `${input.kind}\n${message}`;
    const seen = lastSeen.get(key);
    if (seen !== undefined && t - seen < dedupeMs) return false;
    while (sentAt.length > 0 && t - (sentAt[0] ?? 0) >= MINUTE) sentAt.shift();
    if (sentAt.length >= maxPerMinute) return false;

    lastSeen.set(key, t);
    sentAt.push(t);
    // Old dedupe entries are not worth keeping around.
    for (const [k, at] of lastSeen) if (t - at >= dedupeMs) lastSeen.delete(k);

    const body: ClientErrorReport = {
      message,
      kind: input.kind,
      ...(input.stack ? { stack: cut(scrubSecrets(input.stack), LIMITS.stack) } : {}),
      ...(input.url ? { url: cut(scrubSecrets(input.url), LIMITS.url) } : {}),
      ...(userAgent ? { userAgent: cut(userAgent, LIMITS.userAgent) } : {}),
      ...(appVersion ? { appVersion: cut(appVersion, LIMITS.appVersion) } : {}),
      at: new Date(t).toISOString(),
    };
    void send(body).catch(() => undefined);
    return true;
  }

  return { report };
}

export type ErrorReporter = ReturnType<typeof createErrorReporter>;

/** "#/tasks/64b…?day=2026-09-24" → "/tasks/64b…" (HashRouter; the query may hold a day, never a secret, but goes anyway). */
export function routeFromHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  return path.startsWith('/') ? path : `/${path}`;
}

/** What to say about a thrown value. */
export function describeError(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return { message: `${reason.name}: ${reason.message}`, ...(reason.stack ? { stack: reason.stack } : {}) };
  }
  if (typeof reason === 'string') return { message: reason };
  try {
    return { message: JSON.stringify(reason) ?? String(reason) };
  } catch {
    return { message: String(reason) };
  }
}
