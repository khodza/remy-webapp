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
   else device zone). 24-hour clock everywhere. Reminders live or die on
   timezone correctness.
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
pnpm contract:check  # contract.gen.ts untouched + in sync with ../remy
pnpm test          # vitest: pure logic (dates, day/timeline layout, snooze/when, draft rules)
pnpm check         # typecheck + lint + test + contract:check — run before finishing a task
pnpm smoke         # mock-mode Vite + your Chrome: clicks through every screen (SMOKE_SHOTS=1 saves PNGs)
pnpm build         # tsc --noEmit && vite build → dist/
pnpm preview       # Serve the built bundle
```

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
│   ├── settings/      # settings hooks, useSaveSettings, QuietBar, nudge helpers, time zones
│   └── profile/       # me + timezone sync
├── mocks/             # MSW handlers + fixtures for `pnpm dev:mock`
├── pages/             # Route-level screens (dev/ = gallery, dev only)
└── shared/
    ├── api/           # apiClient + generated contract (contract.gen.ts) + typed endpoint fns
    ├── lib/           # dates, useNow, useAutosave, scrollMemory, telegram/ (back stack, main/settings buttons, theme, haptics, closing confirmation)
    ├── stores/        # Zustand (in-memory auth)
    └── ui/            # The Time canvas kit
```

Pure logic lives in `features/*/lib/*.ts` with a `*.test.ts` next to it;
components stay thin. Everything time-related takes `tz` and `now` as
arguments so it is testable.

## Current screens (Time canvas)

- `/` **Today**: pinned header (month, Search, Timeline | List), week strip
  with load dots, summary line. Timeline = hour grid with NOW line (tap
  opens, swipe right = done, hold + drag = move, 15 min snap); List =
  Overdue / NOW / Later today / Done / Tomorrow / Inbox. `?day=yyyy-MM-dd`
  shows another day.
- `/tasks/:id` **Detail**: title and notes autosave; rows open sheets; snooze
  chips; source; delete with Undo; MainButton Mark as done / Reopen.
- `/catchup` **Catch-up**: one overdue card at a time; MainButton moves all to
  tomorrow.
- `/create` **Create**: sentence → tokens (amber when "at 5" is ambiguous),
  same sheets as Detail, "Looks similar", voice. Saves via `/tasks/structured`.
- `/week` Week + Inbox (`/upcoming` redirects) · `/search` · `/settings`,
  `/settings/quiet`, `/settings/categories`, `/settings/timezone`.
- Deep links: `?task=<id>`, `?screen=settings|catchup|week`, `startapp=`
  the same names or `task_<id>`.

## Design reference

The app implements the **Time canvas** design from `../remy-plan/remy.html`
(Parts 5–6: tokens, building blocks, every screen). Tokens live in
`src/index.css` (`@theme` light, `[data-theme='dark']` dark); `useTheme()`
sets `data-theme` from Telegram and paints Telegram's header and background
with `--color-bg`. `docs/design/` is the older bundle, kept for reference only.

UX rules the screens follow: every time has tabular figures and 24-hour
format; nothing tappable is under 44 px; destructive actions show a toast
with Undo; every sheet sends one field; empty states say what to do next.
