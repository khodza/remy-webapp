/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL incl. `/api/v1`. Defaults to `/api/v1` (Vite proxy). */
  readonly VITE_API_BASE_URL?: string;
  /** `1` enables the MSW mock API (dev only). */
  readonly VITE_MOCK_API?: string;
  /** Telegram user id used by the mocked initData outside Telegram. */
  readonly VITE_MOCK_TG_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
