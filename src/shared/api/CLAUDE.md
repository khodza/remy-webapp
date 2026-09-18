# Backend contract

## The contract is generated — never edit it here

`contract.gen.ts` is a **verbatim copy** of the backend's
`../remy/src/contract/remy-contract.ts` (zod schemas for every request and
response, the `endpoints` table, `DEFAULT_SETTINGS`, `CONTRACT_VERSION`).

- Change a shape → edit the backend file, then in `../remy` run
  `npm run contract:sync` (rewrites `contract.gen.ts` with a sha256 banner).
- `pnpm contract:check` fails if the file was edited by hand (banner hash ≠
  body) or is stale versus the sibling backend repo. `pnpm check` runs it
  after typecheck + lint.
- `schemas.ts` only renames exports (`TaskSchema = client.Task`, …); define
  nothing there. `client.*` coerces ISO strings to `Date`; `wire.*` is the raw
  HTTP shape (used by the MSW mocks to validate what they send).
- `endpoints.ts` parses every request body with the contract's request schema
  before sending and every response with the response schema.
- The file is excluded from ESLint (`eslint.config.js`).

## Transport

- **Base URL**: `VITE_API_BASE_URL` (no trailing slash); prefix `/api/v1` is
  part of it.
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

| Method | Path | Body / query | Returns | `endpoints.ts` |
|---|---|---|---|---|
| POST | `/auth/telegram` | header `tma <raw>` | `AuthResult` | `exchangeInitDataForJwt` |
| GET | `/user/me` | — | `User` | `getMe` |
| PATCH | `/user/timezone` | `{ timezone }` (IANA) | `User` | `updateTimezone` |
| GET | `/settings` | — | `Settings` | `getSettings` |
| PATCH | `/settings` | any subset, nested objects partial | `Settings` | `updateSettings` |
| GET | `/categories` | — | `{ categories }` | `listCategories` |
| POST | `/categories` | `{ name, emoji, color, keywords? }` | `Category` | `createCategory` |
| PATCH | `/categories/:id` | partial | `Category` | `updateCategory` |
| DELETE | `/categories/:id` | — | `{ success }` | `deleteCategory` |
| GET | `/tasks` | `?view=all\|today\|upcoming\|inbox\|done&includeCompleted&limit` | `{ tasks }` | `listTasks` |
| GET | `/tasks/:id` | — | `Task`; 400 bad id, 403 not owned, 404 missing | `getTask` |
| POST | `/tasks` | `{ text }` (server parses) | `Task` | `createTask` |
| POST | `/tasks/structured` | reviewed fields, nothing parsed | `Task` | `createTaskStructured` |
| POST | `/tasks/voice` | multipart `audio` | `Task` | `createTaskFromVoice` |
| PATCH | `/tasks/:id` | `UpdateTaskRequest` (undefined = keep, null = clear) | `Task` | `updateTask` |
| POST | `/tasks/:id/complete` | — | `Task` (recurring: advances) | `completeTask` |
| POST | `/tasks/:id/reopen` | — | `Task` (completed → pending) | `reopenTask` |
| POST | `/tasks/:id/delay` | `{ minutes }` | `Task` | `delayTask` |
| POST | `/tasks/:id/snooze` | `{ until }` ISO, future | `Task` | `snoozeTask` |
| DELETE | `/tasks/:id` | — | `{ success }` | `deleteTask` |
| POST | `/ai/parse` | `{ text }` | `ParsedTask` | `parseText` |

View semantics (`today` includes overdue + completed today, `inbox` = todos,
`done` newest first, capped by `limit`) are documented on `TaskView` in the
contract.

## Task fields

- `description` — the title. `notes` — free text, nullable.
- `kind` — `'reminder'` has a time; `'todo'` has none and lives in the Inbox.
- `scheduledAt` — the series/occurrence time; **null for todos**.
- `snoozedUntil` — set when a **recurring** task was delayed/snoozed; one-off
  tasks move `scheduledAt` instead.
- `nextFireAt` — `snoozedUntil ?? scheduledAt`; **null for todos**. Always
  read it through `fireAt(task)` from `@/shared/lib/dates` (returns
  `Date | null`); sort with `compareByFireAt`.
- `leadMinutes` — heads-up before the time (delivery lands in Phase 3).
- `priority` — `'low' | 'normal' | 'high'`. `categoryId` — nullable id into
  `/categories`.
- `source` — `{ type: text|voice|forward|miniapp, originalText, messageId,
  forwardedFrom }`.
- `completedAt`, `completionsCount` (recurring occurrences marked done).
- `timezone` — IANA zone captured at creation; display uses the *profile*
  zone (`useUserTimezone()`), not this field.
- `isOverdue` — `pending && nextFireAt < now` (server clock); always present,
  always false for todos.

## Hooks

`features/reminders`: `useTasks({view?, includeCompleted?, limit?}, {enabled?})`,
`useTask`, `useCreateTask`, `useCreateTaskStructured`, `useCreateTaskFromVoice`,
`useUpdateTask`, `useCompleteTask`, `useReopenTask`, `useDelayTask`,
`useSnoozeTask`, `useDeleteTask`. Every mutation syncs all cached `['tasks', …]`
lists and `['task', id]`, then invalidates.
`features/settings`: `useSettings`, `useUpdateSettings` (optimistic, same
deep-merge as the server via `mergeSettings`).
`features/categories`: `useCategories`, `useCategoryMap`, `useCreateCategory`,
`useUpdateCategory`, `useDeleteCategory`, `<CategoryChip>`.
