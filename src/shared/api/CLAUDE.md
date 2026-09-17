# Backend contract

- **Base URL**: `VITE_API_BASE_URL` (no trailing slash)
- **Prefix**: `/api/v1` (already included in `VITE_API_BASE_URL`)
- **Auth**: JWT exchange.
  1. Frontend reads raw initData via `retrieveRawInitData()`.
  2. POSTs `Authorization: tma <initDataRaw>` → `/auth/telegram`.
  3. Backend returns `{ token, user, expiresAt }`.
  4. All subsequent requests carry `Authorization: Bearer <jwt>`.
  5. On 401: re-read initData, re-exchange **once** (shared across concurrent
     callers via `auth.store`), retry the original request once.
- JWT lifetime: 15 min. Keep the token in memory; do not persist.
- Error body: `{ statusCode, error, message }`. 5xx messages are generic;
  401/403/404/400 keep their messages. Queries never retry on 400/401/403/404.

## Endpoints (all under the prefix)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/auth/telegram` | header `tma <raw>` | `{ token, expiresAt, user }` |
| GET | `/user/me` | — | `User` |
| PATCH | `/user/timezone` | `{ timezone }` (IANA) | `User` |
| GET | `/tasks` | `?includeCompleted=true` | `{ tasks: Task[] }` with `isOverdue` |
| GET | `/tasks/:id` | — | `Task` with `isOverdue`; 400 bad id, 403 not owned, 404 missing |
| POST | `/tasks` | `{ text }` | `Task` |
| POST | `/tasks/voice` | multipart `audio` | `Task` |
| PATCH | `/tasks/:id` | `{ description?, scheduledAt? (ISO), recurrence? \| null }` | `Task` |
| POST | `/tasks/:id/complete` | — | `Task` (recurring: advances, not completed) |
| POST | `/tasks/:id/delay` | `{ minutes }` | `Task` |
| DELETE | `/tasks/:id` | — | `{ success }` |
| POST | `/ai/parse` | `{ text }` | `{ description, scheduledAt, recurrence }` |

## Task fields (Phase 1)

- `scheduledAt` — the series/occurrence time.
- `snoozedUntil` — set when a **recurring** task was delayed; one-off tasks
  move `scheduledAt` instead. Null otherwise.
- `nextFireAt` — `snoozedUntil ?? scheduledAt`; what the scheduler uses.
  Always read it through `fireAt(task)` from `@/shared/lib/dates`.
- `timezone` — IANA zone captured at creation; display uses the *profile*
  zone (`useUserTimezone()`), not this field.
- `isOverdue` — `status === 'pending' && nextFireAt < now` (server clock),
  present on list and get-one responses only.

All three new fields are optional in `TaskSchema` so an older backend still
works.
