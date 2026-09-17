# Backend contract

- **Base URL**: `VITE_API_BASE_URL` (no trailing slash)
- **Prefix**: `/api/v1` (already included in `VITE_API_BASE_URL`)
- **Auth**: JWT exchange.
  1. Frontend reads raw initData via `retrieveRawInitData()`.
  2. POSTs `Authorization: tma <initDataRaw>` → `/auth/telegram`.
  3. Backend returns `{ token, user, expiresAt }`.
  4. All subsequent requests carry `Authorization: Bearer <jwt>`.
  5. On 401: re-read initData, re-exchange, retry the original request **once**.
- JWT lifetime: 15 min. Keep the token in memory; do not persist.
