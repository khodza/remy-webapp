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
   (landed in Phase 3, once the backend is ready).
3. **Never `100vh`.** The root container uses
   `height: var(--tg-viewport-stable-height, 100dvh)` (set in `src/index.css` on `#root`).
   Fixed bottom bars use `padding-bottom: var(--tg-safe-area-inset-bottom)`.
4. **All dates use `date-fns` + `@date-fns/tz`.** Reminders live or die on
   timezone correctness — respect the user's Telegram timezone.
5. **No localStorage/cookies for auth.** The JWT is in-memory only (Zustand store,
   not persisted). Mini App webviews die on close anyway; this avoids exfil risk
   and simplifies logout.
6. **New feature** → `src/features/<name>/` with `api.ts`, `hooks.ts`,
   `components/`, `index.ts`. Cross-feature sharing goes through `src/shared/`.

## Folder layout

```
src/
├── app/               # SDK init, providers, router, error boundary, root
├── features/          # Domain slices (reminders, ai, profile, settings)
├── pages/             # Route-level compositions
└── shared/
    ├── api/           # apiClient + Zod schemas + typed endpoint fns
    ├── lib/telegram/  # SDK hooks (back/main button, haptics, user, theme)
    ├── stores/        # Zustand stores
    └── ui/            # Thin wrappers over @telegram-apps/telegram-ui
```

## Backend contract (for the API layer, post-scaffold)

- **Base URL**: `VITE_API_BASE_URL` (no trailing slash)
- **Prefix**: `/api/v1` (already included in `VITE_API_BASE_URL`)
- **Auth**: JWT exchange.
  1. Frontend reads raw initData via `retrieveRawInitData()`.
  2. POSTs `Authorization: tma <initDataRaw>` → `/auth/telegram`.
  3. Backend returns `{ token, user, expiresAt }`.
  4. All subsequent requests carry `Authorization: Bearer <jwt>`.
  5. On 401: re-read initData, re-exchange, retry the original request **once**.
- JWT lifetime: 15 min. Keep the token in memory; do not persist.

## Commands

```bash
pnpm dev           # Vite dev server on :5173 with mockTelegramEnv
pnpm dev:https     # Same, via vite-plugin-mkcert (laptop only — mobile TG rejects mkcert)
pnpm dev:tunnel    # Vite + cloudflared — required for real mobile-device testing on prod DC
pnpm typecheck     # tsc --noEmit
pnpm lint          # ESLint strict
pnpm build         # tsc --noEmit && vite build → dist/
pnpm preview       # Preview the built bundle
```

## Telegram test DC vs prod DC

Primary dev loop is **Telegram test DC** — no tunnel needed.
On mobile: Settings → tap version ×10 → Accounts → Login to another → Test.
In BotFather test DC, `http://` and bare IPs are accepted for Mini App URL.

Real device testing on prod DC requires `pnpm dev:tunnel` — `vite-plugin-mkcert`
self-signed certs are rejected by iOS/Android Telegram.

## Debugging live devices

- **Android WebView**: tap the Telegram version 2× to enable WebView debug, then
  open chrome://inspect on your laptop.
- **iOS**: open Safari Web Inspector on your Mac against the paired device.
- **Telegram Desktop Beta**: Settings → Advanced → Experimental → enable webview
  inspection → right-click inside Mini App → Inspect.

## Design reference

Full design bundle lives at `docs/design/` (HTML/CSS tokens + JSX screens for 12
views: Today / Timeline / Triage / Detail / Create / Upcoming / Settings hub /
Notifications / Region / Connected / Categories / Editor). Token source of
truth: `docs/design/project/Remy.html` lines 174–207. Match it faithfully —
light and dark palettes, soft-indigo accent, Inter + JetBrains Mono, 14/20 radii,
64/52 row heights. Dark mode is toggled via `data-theme="dark"` on `<html>` by
`useTheme()`.

## What's NOT scaffolded yet

- **API layer** — `src/shared/api/` is empty on purpose; wait for the backend HTTP
  API to ship, then build `client.ts`, Zod schemas for `Task`/`User`, endpoint
  functions, and the JWT-exchange auth store.
- **Feature screens** — `src/features/*/` are empty barrels. Today/Timeline/
  Create/Settings/etc. land feature-by-feature after the API layer.
