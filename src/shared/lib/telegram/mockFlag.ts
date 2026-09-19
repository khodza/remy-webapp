declare global {
  interface Window {
    __REMY_MOCK_ENV__?: boolean;
  }
}

/** True in dev when the Telegram environment is mocked (plain browser). */
export function isMockEnv(): boolean {
  return import.meta.env.DEV && window.__REMY_MOCK_ENV__ === true;
}
