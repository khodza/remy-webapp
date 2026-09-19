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
`useSnoozeTask`, `useDeleteTask`, `useDeferredDelete` (delete with Undo: the
task is hidden from every list until the toast ends, then DELETE is sent).
Every mutation syncs all cached `['tasks', …]` lists and `['task', id]`, then
invalidates. `useTaskActions` wraps the one-tap actions (done with Undo,
snooze chips, +1h, move) with haptics and toasts.
`features/settings`: `useSettings`, `useUpdateSettings` (optimistic, same
deep-merge as the server via `mergeSettings`).
`features/categories`: `useCategories`, `useCategoryMap`, `useCreateCategory`,
`useUpdateCategory`, `useDeleteCategory`, `<CategoryPill>`.

## Contract 2.1 (Phase 3)

- **Recurrence** gained `yearly` plus optional `interval` (every N weeks /
  months / years), `byWeekday` (`number[]`, 0 = Sun … 6 = Sat, weekly only),
  `lastDayOfMonth` (monthly only) and `until`. In responses (`client.*`) `until`
  is a `Date` (type `Recurrence`); in request bodies it is an ISO string (type
  `RecurrenceInput`). `endpoints.ts` converts it (`recurrenceBody`), so feature
  code always works with the `Date` form.
- These richer rules are created in chat ("gym every Mon and Thu until
  December"). The Repeat sheet cannot express them: it shows the rule
  read-only (`isCustomRecurrence`), and Detail sends one field per sheet, so
  `recurrence` goes out only when another option is picked and saving a task
  never flattens a chat-made rule. `recurrenceLabel(recurrence, tz)` words every
  shape the same way the bot does.
- `nextFireAt` still means "when the task is due (snooze included)".
  `leadMinutes` is now delivered by the bot: a heads-up ping that many minutes
  before, then the reminder itself. The heads-up time never appears in the API.
- **Deep link**: the reminder's "Open in app" button opens
  `<MINI_APP_URL>?task=<id>`; `startapp=task_<id>` works too. `useDeepLink()`
  (mounted inside the Router) navigates once to `/tasks/<id>` with `replace`.

## Contract 2.2 (Phase 4: daily rhythm)

- **`Settings.weeklyWrap: { enabled }`** (default on). `mergeSettings` merges it
  like every other nested object.
- **`Task.snoozeCount`**: times the task was snoozed or delayed, ever. The
  detail screen shows "Snoozed N times" from 3; the bot's weekly wrap flags
  tasks at 4+.
- What the backend does with each rhythm setting (all times are the user's
  local wall clock, 24-hour `HH:mm`):
  - `morningBrief` — at `time`, a message with today's reminders, overdue ones
    and the Inbox; "Move overdue to today" button; replies to it act on its
    numbered tasks. Sent once per local day (within 3 h after `time`, so a
    short outage still delivers it). `/today` in the bot shows it on demand.
  - `eveningReview` — at `time`, the reminders still open (due up to now) with
    per-row buttons: Done, Tomorrow 09:00, No date (Skip for repeating
    tasks), plus "All open → tomorrow".
  - `weeklyWrap` — on the last day of the week (Sunday when `weekStartsOn` is
    1, Saturday when 0) at the evening-review time: done count, streak,
    overdue, most-snoozed tasks, next week.
  - `quietHours` — reminders, heads-ups and nudges due inside `from`–`to`
    (may wrap midnight) are held and arrive when the window ends; high
    priority still rings when `allowHighPriority`.
  - `escalation` — after a reminder is ignored, "still open" nudges at each of
    `stepsMinutes` minutes after it (must be increasing; the backend rejects
    anything else). Low-priority tasks are never nudged; snoozing or
    rescheduling restarts the count.
  - `weekStartsOn` — also decides the wrap day. `hour12` is stored but the app
    shows 24-hour time.
- **Settings UI**: `features/settings/components/RhythmSection.tsx` (Settings
  page). Each control saves immediately with a PATCH carrying only the changed
  nested field; the hook is optimistic and rolls back on error.
- **Deep link**: the bot's /settings button opens `<MINI_APP_URL>?screen=settings`;
  `startapp=settings` works too. `deepLinkTarget()` in `app/useDeepLink.ts`
  resolves `?task=`, `?screen=` and the start param in that order.
