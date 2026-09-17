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
| `react` / `react-dom` | **18.3.1 (exact)** | `@telegram-apps/telegram-ui` has an open React 19 compat bug (GitHub #95). Do not upgrade to 19 until that issue closes. |
| `zustand` | **5.0.3 (exact)** | 5.0.9 introduced a TS middleware regression. Use caret only after verifying. |
| `@telegram-apps/sdk-react` | `^3.3.9` | v3 is the current major. `@tma.js/sdk-react` is the old scope — do not reintroduce it. |
| `@telegram-apps/telegram-ui` | `^2.1.8` | Weakest link in the stack (~12 months stale). Kept behind thin wrappers in `src/shared/ui/` so a later migration to pure Tailwind + TG CSS vars is cheap. |
| `react-router-dom` | `^6.30.1` | **Do not upgrade to v7** — tooling isn't compatible. |
| `tailwindcss` / `@tailwindcss/vite` | `^4` | Tailwind v4 via Vite plugin. Tokens live in `@theme {}` inside `src/index.css`, not a JS config. |
| `zod` | `^4` + `@hookform/resolvers@^5` | Zod 4 + matching resolvers major. |
| `vite` | `^8` | Uses native tsconfig paths via `resolve.tsconfigPaths: true`. |
| `@vitejs/plugin-react-swc` | `^4` | v3 didn't list Vite 8 in its peer range. |
| Node | **22** (see `.nvmrc`) | Matches backend Node version. |

`@telegram-apps/react-router-integration` is **not used** — it only supports
the deprecated SDK v1. Back-button wiring is in `src/shared/lib/telegram/useBackButton.ts`
and calls `navigate(-1)` from react-router-dom directly.

## Architecture rules

1. **Never import `@telegram-apps/telegram-ui` directly in feature code.** Use
   thin wrappers from `src/shared/ui/`. This keeps a future migration cheap.
2. **Never use raw `fetch` in components.** All network goes through `src/shared/api/client.ts`
   (`apiRequest`), plus `auth.ts` / `voice.ts` for the two special cases.
3. **Never `100vh`.** The root container uses
   `height: var(--tg-viewport-stable-height, 100dvh)` (set in `src/index.css` on `#root`).
   Fixed bottom bars use `padding-bottom: var(--tg-viewport-safe-area-inset-bottom)`
   (that is the exact name `viewport.bindCssVars()` emits in SDK v3; there is
   no `--tg-safe-area-inset-*`).
4. **All dates use `date-fns` + `@date-fns/tz`.** Reminders live or die on
   timezone correctness — respect the user's Telegram timezone.
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
pnpm build         # tsc --noEmit && vite build → dist/
pnpm preview       # Serve the built bundle
```

## Dev modes (outside Telegram)

In a plain browser `src/app/mockEnv.ts` fakes the Telegram SDK (theme, viewport,
initData with `hash=dev-mock-hash` and user id `VITE_MOCK_TG_USER_ID`, default
`123456789`). What happens to API calls depends on the mode:

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
`src/shared/api/endpoints.ts`; response shapes are Zod schemas in `schemas.ts`.

## Folder layout

```
src/
├── app/               # SDK init, providers, router, error boundary, root, mockEnv
├── features/          # Domain slices: reminders (hooks, components, lib), profile, settings
├── mocks/             # MSW handlers + fixtures for `pnpm dev:mock`
├── pages/             # Route-level screens
└── shared/
    ├── api/           # apiClient + Zod schemas + typed endpoint fns
    ├── lib/telegram/  # SDK hooks (back/main button, haptics, user, theme)
    ├── stores/        # Zustand (in-memory auth)
    └── ui/            # Thin wrappers over @telegram-apps/telegram-ui
```

## Current screens

`/` Home (today: overdue / later / done, snooze chips) · `/upcoming` agenda by
day · `/create` text + voice with AI parse preview · `/tasks/:id` edit
(description, time, repeat) · `/settings` · `/settings/timezone`.

## Design reference

Full design bundle lives at `docs/design/` (HTML/CSS tokens + JSX screens for 12
views). Token source of truth: `docs/design/project/Remy.html` lines 174–207.
Dark mode is toggled via `data-theme="dark"` on `<html>` by `useTheme()`.
The next redesign ("Time canvas", Timeline + List views) is specified in
`../remy-plan/remy.html`; do not start it without being asked.
