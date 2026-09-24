# CLAUDE.md

This file provides guidance to Claude Code when working with Remy's frontend.

## What this repo is

**Remy Mini App frontend** — the Telegram Mini App companion UI for the Remy AI
reminder assistant. Runs inside the Remy Telegram bot.

## Separate-repo rule (read first)

- **This repo is frontend only.** The NestJS backend lives at
  `/home/khodza/Desktop/myprojects/remy` as a **sibling directory** and a
  **separate git repo**. They are not a monorepo.
- **Do not edit files under `../remy` from this session.** If the backend is
  missing an endpoint or behaves wrong, flag it and let the user decide — they
  handle backend work in a separate session.
- Communication is strictly over HTTP to `VITE_API_BASE_URL` (see `.env.example`).

## Stack + version pins — do not drift

| Package | Version | Why pinned |
|---|---|---|
| `react` / `react-dom` | **18.3.1 (exact)** | The old UI kit blocked 19; it is gone, so 19 is possible now but untested with the SDK. Upgrade deliberately, not in passing. |
| `zustand` | **5.0.3 (exact)** | 5.0.9 introduced a TS middleware regression. Use caret only after verifying. |
| `@telegram-apps/sdk-react` | `^3.3.9` | v3 is the current major. `@tma.js/sdk-react` is the old scope — do not reintroduce it. |
| `vitest` | `^4` | v3 pulls a second Vite (7); v4 works with Vite 8. |
| `playwright-core` | `^1` | Only for `pnpm smoke`; drives your installed Chrome (no browser download). |
| `react-router-dom` | `^6.30.1` | **Do not upgrade to v7** — tooling isn't compatible. |
| `tailwindcss` / `@tailwindcss/vite` | `^4` | Tailwind v4 via Vite plugin. Tokens live in `@theme {}` inside `src/index.css`, not a JS config. |
| `zod` | `^4` + `@hookform/resolvers@^5` | Zod 4 + matching resolvers major. |
| `vite` | `^8` | Uses native tsconfig paths via `resolve.tsconfigPaths: true`. |
| `@vitejs/plugin-react-swc` | `^4` | v3 didn't list Vite 8 in its peer range. |
| Node | **22** (see `.nvmrc`) | Matches backend Node version. |

`@telegram-apps/react-router-integration` is **not used** — it only supports
the deprecated SDK v1. Back-button wiring is in `src/shared/lib/telegram/`
(`backStack.ts` + `useBackButton.ts`): the top handler wins, so an open sheet
closes before the page goes back, and `useGoBack()` falls back to Today when
a deep-linked screen has no history (never `navigate(-1)` directly).

## Architecture rules

1. **UI comes from the kit in `src/shared/ui/`** (Screen, Group, SectionHeader,
   FieldRow, Pill, Chip, Segmented, Toggle, Button, CheckCircle, Sheet,
   toast, Skeleton, Empty/Placeholder, AutoTextarea, TimeField). Colours are
   the Time canvas tokens in `src/index.css` (`bg-surface`, `text-muted`,
   `border-rule`, `bg-accent-soft`, …); never hard-code hex in components.
   `#/dev/gallery` (dev only) shows every piece in both themes.
   Telegram's MainButton is the page's main action (`useMainButton`), its Back
   button is a stack (`useBackButton` for pages, `useBackHandler` for sheets),
   and Settings lives in its ⋯ menu (`useSettingsButton`). No floating buttons.
2. **Never use raw `fetch` in components.** All network goes through `src/shared/api/client.ts`
   (`apiRequest`), plus `auth.ts` / `voice.ts` for the two special cases.
3. **Never `100vh`.** The root container uses
   `height: var(--tg-viewport-stable-height, 100dvh)` (set in `src/index.css` on `#root`).
   Fixed bottom bars use `padding-bottom: var(--tg-viewport-safe-area-inset-bottom)`
   (that is the exact name `viewport.bindCssVars()` emits in SDK v3; there is
   no `--tg-safe-area-inset-*`).
4. **All dates go through `src/shared/lib/dates.ts`.** Never call
   `format`/`isToday`/`startOfDay`/`new Date(input)` on a raw Date in a
   component: use `formatInTz`, `isTodayInTz`, `toLocalInputValue` /
   `fromLocalInputValue`, `fireAt`, … with `useUserTimezone()` (profile zone,
   else device zone). Times follow **the time format setting**
   (`settings.hour12`, Settings → Region): format them with `formatTime`,
   `formatDateTime`, `formatWhen`, `formatClock` (settings "HH:mm" strings)
   or `formatHour` (grid marks), never a hard-coded `HH:mm` pattern. They
   default to the stored preference (`shared/stores/clock.store`, fed by
   `useClockFormatSync()`), and `useUserTimezone()` subscribes to it, so a
   screen that formats a time re-renders when it changes. Reminders live or
   die on timezone correctness.
5. **No localStorage/cookies for auth.** The JWT is in-memory only (Zustand store,
   not persisted). Mini App webviews die on close anyway; this avoids exfil risk
   and simplifies logout.
6. **New feature** → `src/features/<name>/` with `api.ts`, `hooks.ts`,
   `components/`, `index.ts`. Cross-feature sharing goes through `src/shared/`.

## Commands

```bash
pnpm dev           # Vite dev server on :5173 with mockTelegramEnv (needs the backend, see Dev modes)
pnpm dev:mock      # Same, but the API is mocked in-browser with MSW — no backend needed
pnpm dev:https     # Same, via vite-plugin-mkcert (laptop only — mobile TG rejects mkcert)
pnpm dev:tunnel    # Vite + cloudflared — real mobile-device testing on prod DC (random URL)
pnpm dev:ngrok     # Vite + ngrok tunnel (stable URL with NGROK_DOMAIN, HMR over the tunnel)
pnpm preview:ngrok # Production build + ngrok tunnel — fastest way to test inside Telegram
pnpm typecheck     # tsc --noEmit
pnpm lint          # ESLint, --max-warnings 0
pnpm contract:check  # contract.gen.ts untouched + in sync with the backend (../remy, or REMY_BACKEND_DIR=/path)
pnpm test          # vitest: `unit` (*.test.ts, node: dates, day/timeline layout, snooze/when, draft rules)
                   #         + `dom` (*.test.tsx, jsdom + Testing Library: hooks, rows, pages)
pnpm format        # Prettier --write (single quotes, trailing commas, 120 columns; *.md left alone)
pnpm format:check  # Prettier --check, what CI runs
pnpm check         # typecheck + lint + test + contract:check + format:check — run before finishing a task
pnpm smoke         # mock-mode Vite + your Chrome: clicks through every screen (SMOKE_SHOTS=1 saves PNGs,
                   # CHROME_PATH=/path/to/chromium for another binary)
pnpm build         # tsc --noEmit && vite build → dist/
pnpm preview       # Serve the built bundle
```

Formatting is Prettier (`.prettierrc`, `.editorconfig`); ESLint checks code,
not style. `.github/workflows/ci.yml` runs install, typecheck, lint, test,
contract:check and format:check on every push to `master` and every pull
request, plus the smoke in a second job against the runner's Chrome
(`playwright-core`, no browser download). pnpm comes from the
`packageManager` field via corepack, so bump it there, not in the workflow.

## Dev modes (outside Telegram)

In a plain browser `src/app/mockEnv.ts` fakes the Telegram SDK (theme, viewport,
initData with `hash=dev-mock-hash` and user id `VITE_MOCK_TG_USER_ID`, default
`123456789`). `?theme=light` switches the fake theme; `DevChrome` draws
Telegram's header (Back, ⋯) and MainButton so every flow works in a browser.
What happens to API calls depends on the mode:

1. **Mock API** — `pnpm dev:mock` (`VITE_MOCK_API=1`). MSW intercepts every
   endpoint in `src/shared/api/` with in-memory fixtures from `src/mocks/`.
   Use this for UI work; no backend, no Mongo, no OpenAI.
2. **Real backend** — `pnpm dev`. Vite proxies `/api` to `localhost:3000`. The
   backend rejects the mock initData unless it runs with
   `DEV_ALLOW_MOCK_INITDATA=true` and `OWNER_TELEGRAM_ID=<VITE_MOCK_TG_USER_ID>`
   (both dev-only; see `../remy/.env.example`).
3. **Inside Telegram** — test DC without a tunnel, or prod DC with
   `pnpm preview:ngrok`. See `.claude/skills/telegram-device-testing/SKILL.md`.

## Backend contract

See `src/shared/api/CLAUDE.md` (base URL, `/api/v1` prefix, `tma` → JWT
exchange, 401 retry-once rule). Endpoint functions live in
`src/shared/api/endpoints.ts`. Every request/response shape comes from
`src/shared/api/contract.gen.ts`, a **generated verbatim copy** of the backend
contract: never edit it (or redefine shapes in `schemas.ts`); change
`../remy/src/contract/remy-contract.ts` and run `npm run contract:sync` there.

## Folder layout

```
src/
├── app/               # SDK init, providers, router, error boundary, root, mockEnv, deep links
├── features/
│   ├── reminders/     # task hooks, useTaskActions, TaskRow, sheets (When/Lead/Repeat/Category/Priority), lib (when, draft, recurrence)
│   ├── today/         # day + week model, timeline layout, Timeline/List views, WeekStrip, LoadStrip
│   ├── categories/    # category hooks, CategoryPill
│   ├── lists/         # GET /lists hook, ListSheet (pick / new list), list-name normalisation
│   ├── ai/            # useParsePreview (POST /ai/parse: drafts, 422 as `rejected`)
│   ├── data/          # Your data: calendar feed, export, import, Delete all data
│   ├── diagnostics/   # client error reports → POST /client-errors (reporter + install)
│   ├── settings/      # settings hooks, useSaveSettings, QuietBar, nudge helpers, time zones
│   └── profile/       # me + timezone sync
├── mocks/             # MSW handlers + fixtures for `pnpm dev:mock`
├── pages/             # Route-level screens (dev/ = gallery, dev only)
└── shared/
    ├── api/           # apiClient + generated contract (contract.gen.ts) + typed endpoint fns
    ├── lib/           # dates, useNow, useAutosave, scrollMemory, density, usePullToRefresh, useVoiceRecorder,
    │                  # useTokenRefresh, telegram/ (back stack, main/settings buttons, theme, haptics, closing confirmation)
    ├── stores/        # Zustand (in-memory auth with refresh/recover, 12/24-hour clock preference)
    └── ui/            # The Time canvas kit
test/                  # vitest setup, renderWithProviders, mockApi()/signIn(), fixtures, a fake MediaRecorder
```

Pure logic lives in `features/*/lib/*.ts` with a `*.test.ts` next to it;
components stay thin. Everything time-related takes `tz` and `now` as
arguments so it is testable. Components and hooks get a `*.test.tsx`
(Testing Library, `renderWithProviders`, `mockApi()` for a mocked `fetch`,
fake timers for debounces and recorder caps); whole flows are the smoke.
Parsing for Create lives in `features/ai` (`useParsePreview`: 800 ms
debounce, a superseded parse is aborted through React Query's signal).

Per-device preferences (not synced to the account) live in `localStorage`
and are applied as attributes on `<html>` at boot: `data-density="compact"`
(Settings → Compact rows, `shared/lib/density`; row heights come from the
`--spacing-row*` / `--spacing-field*` tokens and never go under 44 px) and
`data-clock` (a copy of the account's time format so the first paint is
right). Auth is never stored (rule 5).

## Current screens (Time canvas)

- `/` **Today**: pinned header (greeting from the profile name and the hour
  in the profile zone, month + date, Search, Timeline | List), week strip
  with load dots, summary line, pull to refresh. Timeline = hour grid with NOW line (tap
  opens, swipe right = done, hold + drag = move, 15 min snap); List =
  Overdue / NOW / Later today / Done / Tomorrow / Inbox. `?day=yyyy-MM-dd`
  shows another day. **All-day tasks** (`allDay`, no clock time) sit in a strip
  above the grid / first in each list section and read "All day"; they are
  overdue only after their day (`isLate`, never `isOverdue` alone). A
  **repeating task ticked Done stays on the day**: `completions[]` become
  done rows (`DayItem.occurrence`, id `<taskId>@<occurrenceAt>`) while the
  task itself moves on to its next date; the week strip counts them too.
- `/tasks/:id` **Detail**: title and notes autosave; rows open sheets
  (When with a "No specific time" toggle, Repeat with a "Stop after N
  times" stepper, Category, Priority, Lead, **List** with suggestions from
  `GET /lists`); snooze chips; "Skip this time" for repeating tasks
  (`POST /tasks/:id/skip`); **Done N times** history from `completions[]`
  (first 5, "Show all"); source, with **Show source message** when
  `source.messageId` is set (404 "message not found" / 409 "deleted" toasts);
  delete with Undo; MainButton Mark as done / Reopen. Marking a task that
  the bot already ticked says "Already done for today. Next: …"
  (`CompleteResult.alreadyDone`).
- `/catchup` **Catch-up**: one overdue card at a time; "Skip this time →"
  on repeating tasks (real skip), "Skip →" just hides a one-off; MainButton
  moves all to tomorrow.
- `/create` **Create**: sentence → tokens from the parse (`TaskDraft`: time,
  all day, repeat with count, lead, priority, category, list; amber when
  "at 5" is ambiguous), same sheets as Detail, "Looks similar", voice. A
  sentence that holds **several reminders** (`ParsedTask.drafts`) turns into
  a reviewable list (`DraftReviewList`, shared with Import) and saves through
  `tasks/import`; "Just one" goes back to a single draft. A 422 ("not a
  task") shows inline (`data-parse-rejected`) and the text can still be added
  as is. Saves via `/tasks/structured`.
- `/week` **Week + Inbox** (`/upcoming` redirects): the calendar week from
  `settings.weekStartsOn`, previous / next / This week, hold a row and drag
  it to another day (keeps the time of day, Undo toast), pull to refresh.
  The Inbox is **grouped by list** (headers with counts, tasks without a list
  last) with filter chips fed by `GET /lists`.
- `/search`: server search, `GET /tasks?q=` (every word must match title,
  notes or list name; open and done), 300 ms debounce, a superseded request
  is aborted, the last result stays on screen while typing; grouped Overdue /
  Upcoming / Inbox / Done, capped at `SEARCH_LIMIT`.
- `/settings` (Region: time zone, **Time format** 24 h | 12 h; Rhythm
  incl. **Voice brief** and **Pinned agenda** toggles; Organisation: Compact
  rows, a device preference; Your data: calendar, export **CSV · JSON ·
  ICS**, import, **Delete all data** — a sheet that asks to type `DELETE`,
  sends `DELETE /data`, resets every query cache and lands on an empty
  Today), `/settings/quiet`, `/settings/categories`, `/settings/timezone`.
- **Your data** (`features/data`): `/settings/calendar` turns the private
  calendar feed on/off, shows the link (made absolute from the API base by
  `feedLinks`, warns when it points at localhost), opens Google's "add by
  URL" page or `webcal://` for Apple, and replaces the link. Export (sheet in
  Settings) makes the **bot send the file to the chat** (downloads don't work
  in iOS webviews). `/settings/import`: paste a list → `parse-list` drafts →
  untick / change times → `tasks/import` (all or nothing); a ticked line
  whose time has passed ("Fix N past times") must be changed or unticked,
  like the When sheet.
- **Google Calendar** (`features/integrations`): `/settings/google`, from
  the "Google Calendar" row in Your data. Not configured → the env the
  server needs; configured → MainButton "Connect Google Calendar" opens the
  consent URL outside the webview (`openExternalLink`) and the status is
  polled every 5 s for two minutes (`connectPollInterval`), next to an
  "I've connected, refresh" row; connected → the account, the calendars with
  ticks (one optimistic PATCH per tap), and Disconnect behind a sheet.
  409 / 502 / 404 each get a sentence (`googleFailureMessage`).
- Deep links: `?task=<id>`, `?screen=settings|catchup|week`, `startapp=`
  the same names or `task_<id>`.

## Session and diagnostics

- **JWT refresh** (`shared/lib/useTokenRefresh`, mounted in `Root`): the
  token is refreshed through `POST /auth/refresh` at 80 % of its lifetime
  (`exp`/`iat` decoded from the JWT) while the app is visible, retried a
  minute later on failure; a 401 makes `apiRequest` call
  `auth.store.recover()`, which refreshes **once** before falling back to a
  fresh initData exchange, then retries the request once. Still in memory
  only.
- **Client errors** (`features/diagnostics`): `installErrorReporting()` in
  `index.tsx` sends `window.onerror`, `unhandledrejection`, ErrorBoundary
  renders and failed API calls (network / 5xx only, never 401/403/404) to
  `POST /client-errors`, deduped per message for a minute, at most 5 a
  minute, only once signed in, with the route from the hash, the app version
  (`__APP_VERSION__` from `package.json` via Vite `define`) and the user
  agent. `scrubSecrets` strips `tma …`, `Bearer …`, `hash=` and initData from
  messages and stacks. The report itself is `silent` (never re-reported).

## Design reference

The app implements the **Time canvas** design from `../remy-plan/remy.html`
(Parts 5–6: tokens, building blocks, every screen). Tokens live in
`src/index.css` (`@theme` light, `[data-theme='dark']` dark); `useTheme()`
sets `data-theme` from Telegram and paints Telegram's header and background
with `--color-bg`. `docs/design/` is the older bundle, kept for reference only.

UX rules the screens follow: every time has tabular figures and follows the
time format setting; nothing tappable is under 44 px (a smaller control gets
an invisible 44 px hit area, see `Segmented`, `Token`, the +1h pill); destructive actions show a toast
with Undo; every sheet sends one field; empty states say what to do next.
