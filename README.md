# Remy Mini App

AI reminder assistant — Telegram Mini App companion for the Remy bot.

## Prerequisites

- Node.js 22 (see `.nvmrc` — `nvm use` if you have nvm installed)
- pnpm (install via `corepack enable pnpm`)
- A working Remy bot token (ask the backend owner) for BotFather registration

## Setup

```bash
cp .env.example .env        # then fill VITE_API_BASE_URL
pnpm install
pnpm dev                    # opens on http://localhost:5173
```

In a browser, the app runs with a mocked Telegram environment (see
`src/app/mockEnv.ts`) so you can iterate on UI without Telegram. `eruda` is
auto-loaded on mobile when `tgWebAppStartParam` includes `debug` or in any dev
build.

## Testing inside Telegram

### Test DC (recommended for everyday dev — no tunnel required)

1. In Telegram mobile: Settings → tap the version number **10 times** → Accounts
   → Login to another account → Test. BotFather in test DC accepts `http://` and
   bare IPs.
2. In BotFather (test DC): `/newapp` or `/editapp`, point the Mini App URL at
   your laptop IP, e.g. `http://192.168.1.42:5173/`.
3. Open the bot → Menu → launch the Mini App.

### Prod DC — Telegram Web, Desktop, mobile (requires tunnel)

`vite-plugin-mkcert` self-signed certs are rejected by iOS/Android Telegram on
prod DC, so expose the app through a tunnel. Start the backend first (`../remy`:
MongoDB + `npm run dev:api`); Vite proxies `/api` to it, so one tunnel covers both.

**ngrok (recommended):**

1. One-time: put your token from
   https://dashboard.ngrok.com/get-started/your-authtoken in `.env.local`:
   `NGROK_AUTHTOKEN=...`. Free accounts get one static domain (dashboard →
   Domains); set `NGROK_DOMAIN=<it>` so the URL stops changing between runs.
2. Run one of:

   | Command | Serves | Use when |
   |---|---|---|
   | `pnpm preview:ngrok` | production build (~140 KB gzipped) | testing in Telegram — loads in seconds even on a slow uplink |
   | `pnpm dev:ngrok` | Vite dev server with HMR (~4.6 MB unbundled) | your upload is fast enough for live reload |

3. Copy `Mini App URL` from the output into BotFather (Configure Mini App and
   Menu Button). With `NGROK_DOMAIN` set this is a one-time step.
4. The first open on each client shows ngrok's free-plan "You are about to
   visit" page — tap **Visit Site** once (remembered ~7 days). In Telegram Web
   that cookie is third-party, so use a Chromium browser or Firefox; Safari
   blocks it.

**Cloudflared (no account):** `pnpm dev:tunnel`, then set the random
`https://<random>.trycloudflare.com` URL in BotFather on every run.

## How auth works

1. On first launch the frontend reads raw initData via
   `@telegram-apps/sdk-react`'s `retrieveRawInitData()`.
2. It POSTs `Authorization: tma <initDataRaw>` to `POST /auth/telegram`.
3. The backend verifies the HMAC (or Ed25519 on Bot API 8.0+), upserts the user,
   and returns `{ token, user, expiresAt }` with a **15-minute JWT**.
4. Every subsequent request sends `Authorization: Bearer <jwt>`.
5. On 401 the client re-reads initData and re-exchanges once, then retries.

The JWT is kept in memory only — never persisted to localStorage or cookies.

## Folder layout

```
src/
├── app/           # SDK init, providers, router, error boundary, Root, deep links
├── features/      # reminders, today, categories, settings, profile
├── mocks/         # MSW handlers + fixtures (pnpm dev:mock)
├── pages/         # Route-level screens
└── shared/
    ├── api/       # apiClient, generated contract, endpoint fns
    ├── lib/       # dates, autosave, scroll memory, telegram/ SDK hooks
    ├── stores/    # Zustand (in-memory auth)
    └── ui/        # The Time canvas component kit
```

Strict alias `@/` → `src/`. All dates go through `date-fns` + `@date-fns/tz`.

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | Vite dev server on :5173 with mock Telegram env |
| `pnpm dev:https` | HTTPS dev via mkcert (laptop only — mobile rejects) |
| `pnpm dev:tunnel` | Vite + cloudflared (real-device, prod DC) |
| `pnpm dev:ngrok` | Vite + ngrok tunnel (HMR over the tunnel) |
| `pnpm preview:ngrok` | Production build + ngrok tunnel (fast in Telegram) |
| `pnpm dev:mock` | Dev server with the API mocked in the browser (no backend); `?theme=light` for light |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, `--max-warnings 0` |
| `pnpm test` | Vitest unit tests (pure logic) |
| `pnpm check` | typecheck + lint + test + contract check |
| `pnpm smoke` | Mock-mode app + your Chrome: clicks through every screen |
| `pnpm build` | Typecheck + production build into `dist/` |
| `pnpm preview` | Serve the built bundle |

## Design source

The **Time canvas** design in `../remy-plan/remy.html` (tokens, building blocks
and every screen, light and dark). Tokens are in `src/index.css`; the kit is in
`src/shared/ui/`; `#/dev/gallery` in dev shows it. `docs/design/` is the older
bundle, kept for reference.

## Backend

Backend lives in a **separate sibling repo** at `../remy` (NestJS + Grammy +
MongoDB + OpenAI). Do not edit it from this project. See `CLAUDE.md` for the
expected HTTP contract.
