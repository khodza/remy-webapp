# Backend contract

## The contract is generated — never edit it here

`contract.gen.ts` is a **verbatim copy** of the backend's
`../remy/src/contract/remy-contract.ts` (zod schemas for every request and
response, the `endpoints` table, `DEFAULT_SETTINGS`, `CONTRACT_VERSION`).

- Change a shape → edit the backend file, then in `../remy` run
  `npm run contract:sync` (rewrites `contract.gen.ts` with a sha256 banner;
  `REMY_WEBAPP_DIR=/path` there points it at another checkout of this repo).
- `pnpm contract:check` fails if the file was edited by hand (banner hash ≠
  body) or is stale versus the sibling backend repo (`../remy`, or
  `REMY_BACKEND_DIR=/path`; when neither exists only the banner is checked).
  `pnpm check` runs it after typecheck + lint.
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
  5. **Refresh before expiry**: `useTokenRefresh()` (mounted in `Root`)
     POSTs `/auth/refresh` with the current Bearer at 80 % of the token's
     lifetime (`iat`/`exp` decoded from the JWT, `decodeJwtTimes`) while the
     document is visible, and again a minute later when it failed. A refresh
     needs a still-valid JWT; the server ends the session 7 days after the
     initData exchange, after which it answers 401.
  6. On 401: `apiRequest` calls `auth.store.recover(rejectedToken)`: a newer
     usable token if one arrived meanwhile, else **one** refresh, else clear
     and re-exchange initData **once** (shared across concurrent callers via
     `inFlight` / `refreshing`), then retry the original request once. A 401
     on the retry surfaces as `failure: 'session-expired'`.
- JWT lifetime: 15 min. Keep the token in memory; do not persist.
- Error body: `{ statusCode, error, message }`. 5xx messages are generic;
  401/403/404/400 keep their messages. Queries never retry on 400/401/403/404.

## Endpoints (all under the prefix)

| Method | Path | Body / query | Returns | `endpoints.ts` |
|---|---|---|---|---|
| POST | `/auth/telegram` | header `tma <raw>` | `AuthResult` | `exchangeInitDataForJwt` |
| POST | `/auth/refresh` | Bearer (still valid) | `AuthResult` | `refreshJwt` (raw fetch, bypasses the 401 retry) |
| GET | `/user/me` | — | `User` | `getMe` |
| PATCH | `/user/timezone` | `{ timezone }` (IANA) | `User` | `updateTimezone` |
| GET | `/settings` | — | `Settings` | `getSettings` |
| PATCH | `/settings` | any subset, nested objects partial | `Settings` | `updateSettings` |
| GET | `/categories` | — | `{ categories }` | `listCategories` |
| POST | `/categories` | `{ name, emoji, color, keywords? }` | `Category` | `createCategory` |
| PATCH | `/categories/:id` | partial | `Category` | `updateCategory` |
| DELETE | `/categories/:id` | — | `{ success }` | `deleteCategory` |
| GET | `/tasks` | `?view=all\|today\|upcoming\|inbox\|done&includeCompleted&limit&list=<name>&q=<words>` | `{ tasks }` | `listTasks(params, { signal })` |
| GET | `/lists` | — | `{ lists: [{ name, count }] }` (open tasks per list) | `listLists` |
| GET | `/tasks/:id` | — | `Task`; 400 bad id, 403 not owned, 404 missing | `getTask` |
| POST | `/tasks` | `{ text }` (server parses) | `Task` | `createTask` |
| POST | `/tasks/structured` | reviewed fields, nothing parsed | `Task` | `createTaskStructured` |
| POST | `/tasks/voice` | multipart `audio` | `Task` | `createTaskFromVoice` |
| PATCH | `/tasks/:id` | `UpdateTaskRequest` (undefined = keep, null = clear) | `Task` | `updateTask` |
| POST | `/tasks/:id/complete` | — | `CompleteResult` = `Task & { alreadyDone }` (recurring: advances, appends to `completions`) | `completeTask` |
| POST | `/tasks/:id/skip` | — | `Task` (recurring only: next occurrence, nothing done; the last one completes the task) | `skipOccurrence` |
| POST | `/tasks/:id/show-source` | — | `{ success }`; 404 no `source.messageId`, 409 message deleted, 429 (20/min), 502 Telegram | `showTaskSource` |
| POST | `/tasks/:id/reopen` | — | `Task` (completed → pending) | `reopenTask` |
| POST | `/tasks/:id/delay` | `{ minutes }` | `Task` | `delayTask` |
| POST | `/tasks/:id/snooze` | `{ until }` ISO, future | `Task` | `snoozeTask` |
| DELETE | `/tasks/:id` | — | `{ success }` | `deleteTask` |
| POST | `/ai/parse` | `{ text }` | `ParsedTask` = `TaskDraft & { drafts: TaskDraft[] }`; 422 when it is not a task | `parseText` |
| POST | `/ai/parse-list` | `{ text }` | `{ tasks: TaskDraft[] }`, nothing saved | `parseList` |
| POST | `/tasks/import` | `{ tasks: TaskDraft-like[] }` | `{ tasks }` (all or nothing) | `importTasks` |
| GET/POST/DELETE | `/calendar/feed` | — | `CalendarFeed` (POST replaces the token, DELETE turns it off) | `getCalendarFeed` / `enableCalendarFeed` / `disableCalendarFeed` |
| POST | `/export` | `{ format: csv\|json\|ics }` | `ExportResult`; the bot sends the file to the chat | `exportData` |
| DELETE | `/data` | `{ confirm: 'DELETE' }` (literal) | `{ success, deletedTasks }`; tasks, categories, lists, settings gone, the account stays | `deleteAllData` |
| POST | `/client-errors` | `ClientErrorReport` | 204 | `reportClientError` (`silent`: its own failure is never re-reported) |
| GET | `/integrations/google/status` | — | `GoogleStatus` (`configured`, `connected`, `email?`, `calendars?` with `selected`) | `getGoogleStatus` |
| POST | `/integrations/google/connect` | — | `GoogleConnectResult` `{ url }` (consent URL, open outside the webview; signed `state`, 10 min); 409 not configured | `connectGoogle` |
| PATCH | `/integrations/google` | `{ calendarIds }` (empty = primary only) | the fresh `GoogleStatus` when the server sends one (else `null`, refetch); 400 unknown id, 404 not connected, 502 Google | `selectGoogleCalendars` |
| DELETE | `/integrations/google` | — | revokes the grant and forgets the account | `disconnectGoogle` |

View semantics (`today` includes overdue + completed today, `inbox` = todos,
`done` newest first, capped by `limit`) are documented on `TaskView` in the
contract. `q` is a search: every word must appear in the title, notes or list
name; pending and completed come back, deleted never; `list` narrows to one
normalised list name. Both combine with `view`.

## Task fields

- `description` — the title. `notes` — free text, nullable.
- `kind` — `'reminder'` has a time; `'todo'` has none and lives in the Inbox.
- `scheduledAt` — the series/occurrence time; **null for todos**.
- `allDay` — a date without a clock time. `scheduledAt` is then 09:00 on that
  date in the task's zone (when the bot pings it); show the date only and
  treat it as overdue only once the whole day is over (`isLate` in
  `features/today`, `isPastAt` in `features/reminders`), not on `isOverdue`
  alone. To create one, send `allDay: true` with any instant on the date.
- `list` — a named list, lower case and normalised by the server (trim,
  lower case, drops a leading "my" / "the" and a trailing "list", 40 chars;
  `normaliseListName` in `features/lists` predicts the result). Null when
  none. `GET /lists` returns the names with open counts.
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
- `completedAt` (one-offs), `completionsCount` (every Done tap on a
  recurring task, ever) and `completions[]` (`{ at, occurrenceAt }`, the
  last 30 days, at most 50, newest first): `occurrenceAt` is the occurrence
  that was done, which is how a done occurrence stays on its day in Today
  and Week after the task itself moved on. `completeTask` returns
  `alreadyDone: true` when nothing changed (a completed one-off, or a
  repeating task whose series already sits in the future).
- `timezone` — IANA zone captured at creation; display uses the *profile*
  zone (`useUserTimezone()`), not this field.
- `isOverdue` — `pending && nextFireAt < now` (server clock); always present,
  always false for todos.

## Hooks

`features/reminders`: `useTasks({view?, includeCompleted?, limit?, list?}, {enabled?})`,
`useSearchTasks(query)` (`GET /tasks?q=`, `SEARCH_DEBOUNCE_MS` = 300 ms,
`SEARCH_LIMIT`, `keepPreviousData`, the superseded request is aborted through
React Query's signal; returns `debounced` so the page knows when it is
current), `useTask`, `useCreateTask`, `useCreateTaskStructured`,
`useCreateTaskFromVoice`, `useUpdateTask`, `useCompleteTask`
(`CompleteResult`), `useSkipOccurrence`, `useShowTaskSource`, `useReopenTask`,
`useDelayTask`, `useSnoozeTask`, `useDeleteTask`, `useDeferredDelete` (delete
with Undo: the task is hidden from every list until the toast ends, then
DELETE is sent). Every mutation syncs all cached `['tasks', …]` lists
(search results included, their key is `['tasks', { search }]`) and
`['task', id]`, then invalidates. `useTaskActions` wraps the one-tap actions
(done with Undo, `alreadyDone` toast, `doneOccurrence`, `skip`, snooze chips,
+1h, move) with haptics and toasts.
`features/lists`: `useLists` (`GET /lists`), `<ListSheet>` (no list / existing
lists with counts / a new name), `normaliseListName`, `listTitle`.
`features/ai`: `useParsePreview(text)` → `{ parsed, rejected, failed, … }`;
`rejected` is the 422 message (not a task) and is not a failure.
`features/data`: `useCalendarFeed` & co, `useExportData`, `useParseList`,
`useImportTasks`, `useDeleteAllData` (resets every query on success),
`<DeleteAllDataSheet>`.
`features/integrations`: `useGoogleStatus(pollUntil?)`, `useConnectGoogle(onConnected)`
(POST, then polls the status every `CONNECT_POLL_MS` until connected or
`CONNECT_POLL_WINDOW_MS` passed; `waiting`, `stopWaiting`),
`useSelectGoogleCalendar` (one tick, optimistic, rolls back),
`useDisconnectGoogle`, `googleFailureMessage(action, error)`.
`features/diagnostics`: `installErrorReporting()` (once, in `index.tsx`),
`reportRenderError` (ErrorBoundary), `createErrorReporter` (pure, tested).
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

## Contract 2.4.0 (plan gaps, lists, all-day, diagnostics)

- **Task**: `allDay`, `list`, `completions[]` (above). `Recurrence.count`
  (stop after N occurrences, done and skipped both count; with `until` too,
  whichever comes first): `recurrenceLabel` appends "× N times", the Repeat
  sheet has a "Stop after" stepper and keeps the count when another option is
  picked; `isCustomRecurrence` ignores it.
- **`POST /ai/parse` → `ParsedTask`** is a `TaskDraft` (`description`, `notes`,
  `scheduledAt`, `allDay`, `recurrence`, `categoryId`, `leadMinutes`,
  `priority`, `list`) plus `drafts[]`: when the sentence held several
  reminders the top level is the first and `drafts` has them all, and Create
  shows the reviewable list (`DraftReviewList`) and saves them through
  `POST /tasks/import`. A **422** means "this is not a task": Create shows the
  message inline and still offers to add the text as it is. The same
  `TaskDraft` shape is what `parse-list` returns and `tasks/import` takes.
- **`POST /tasks/structured`** and **`PATCH /tasks/:id`** accept `allDay`
  (needs `scheduledAt`; send it only when true on create, together with
  `scheduledAt` when saving from the When sheet) and `list` (null clears).
- **`POST /tasks/:id/complete` → `CompleteResult`**: `alreadyDone` turns the
  Done toast into "Already done for today. Next: …" (or "Already done.")
  instead of an Undo; the cache is still synced from the returned task.
- **`POST /tasks/:id/skip`**: Catch-up ("Skip this time →") and Detail ("Skip
  this time") on repeating tasks; a one-off is only hidden. The last
  occurrence completes the task ("That was the last one.").
- **`POST /tasks/:id/show-source`**: Detail offers "Show source message" only
  when `source.messageId !== null`; 404 / 409 / 429 / 502 each get their own
  toast (`showSourceFailure`).
- **`GET /lists`** feeds the List sheet, the Inbox headers and the Week
  filter chips. **`GET /tasks?q=`** is the Search page. `GET /tasks?list=`
  exists but the Inbox groups client-side from one `inbox` fetch.
- **Settings**: `voiceBrief` (the morning brief also as a voice message) and
  `pinnedAgenda` (a live "Today" message kept pinned in the chat), both
  default off, top-level booleans merged by `mergeSettings` like any other
  field.
- **`POST /export`** also takes `ics` (pending reminders as a calendar file,
  sent by the bot). **`DELETE /data`** needs the literal `{ confirm:
  'DELETE' }` and returns `deletedTasks`; the sheet makes the user type the
  word, then `resetQueries()` and navigates to an empty Today.
- **`POST /auth/refresh`** and the recover order are under Transport.
- **`POST /client-errors`** (`ClientErrorReport`, strict: `message` ≤ 1000,
  `stack` ≤ 8000, `url` ≤ 2000 (the app route from the hash, no query),
  `userAgent` ≤ 500, `appVersion` ≤ 64, optional `kind` and `at`) is sent by `features/diagnostics` for
  window errors, unhandled rejections, ErrorBoundary catches and failed API
  calls (network / 5xx only; never 401/403/404, never an `AbortError`),
  deduped per message for a minute, at most 5 a minute, only once a token
  exists. `scrubSecrets` removes `tma …`, `Bearer …`, `hash=…` and initData
  from message, stack and url before sending; the request is `silent`, so a
  failing report never reports itself.
- **Google Calendar** (`/integrations/google/*`, table above): the Mini App's
  `/settings/google`. The consent flow runs in the system browser, so the
  page cannot see it end: after `POST …/connect` it polls the status for two
  minutes. The mock starts connected with two calendars; Disconnect then
  Connect turns the account back on 3 s later, which the polling picks up.
- The MSW mocks (`src/mocks/handlers.ts`) implement all of it: `q`/`list`
  filters, `/lists`, skip, show-source (404 without a message id, 409 for one
  fixture), `alreadyDone`, `completions`, a 422 for greetings, several drafts
  for "a; b" / "a and then b", `/auth/refresh` (accepts `mock-jwt-token*`
  Bearers only), `DELETE /data`, `/client-errors` → 204.
