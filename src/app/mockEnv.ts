import {
  emitEvent,
  isTMA,
  mockTelegramEnv,
} from '@telegram-apps/sdk-react';

/**
 * Outside Telegram (a plain browser in dev), fake the environment the SDK
 * expects. index.tsx imports this module only in dev builds, so none of it
 * ships to production.
 */
export async function mockTelegramEnvIfNeeded(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (!(await isTMA('complete'))) {
    window.__REMY_MOCK_ENV__ = true;
    // ?theme=light previews the light palette; the default mock is dark.
    const light = new URLSearchParams(window.location.search).get('theme') === 'light';
    const darkParams = {
      accent_text_color: '#6ab2f2',
      bg_color: '#17212b',
      button_color: '#5288c1',
      button_text_color: '#ffffff',
      destructive_text_color: '#ec3942',
      header_bg_color: '#17212b',
      hint_color: '#708499',
      link_color: '#6ab3f3',
      secondary_bg_color: '#232e3c',
      section_bg_color: '#17212b',
      section_header_text_color: '#6ab3f3',
      subtitle_text_color: '#708499',
      text_color: '#f5f5f5',
    } as const;
    const lightParams = {
      accent_text_color: '#168acd',
      bg_color: '#ffffff',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
      destructive_text_color: '#d14e4e',
      header_bg_color: '#ffffff',
      hint_color: '#999999',
      link_color: '#2481cc',
      secondary_bg_color: '#f1f1f4',
      section_bg_color: '#ffffff',
      section_header_text_color: '#6d6d72',
      subtitle_text_color: '#999999',
      text_color: '#000000',
    } as const;
    const themeParams = light ? lightParams : darkParams;
    const noInsets = { left: 0, top: 0, bottom: 0, right: 0 } as const;
    // Must match OWNER_TELEGRAM_ID on the backend when using its dev bypass
    // (DEV_ALLOW_MOCK_INITDATA=true), which accepts hash=dev-mock-hash.
    const mockUserId =
      Number(import.meta.env.VITE_MOCK_TG_USER_ID) || 123456789;

    mockTelegramEnv({
      onEvent(event) {
        const [name] = event;
        if (name === 'web_app_request_theme') {
          return emitEvent('theme_changed', { theme_params: themeParams });
        }
        if (name === 'web_app_request_viewport') {
          return emitEvent('viewport_changed', {
            height: window.innerHeight,
            width: window.innerWidth,
            is_expanded: true,
            is_state_stable: true,
          });
        }
        if (name === 'web_app_request_content_safe_area') {
          return emitEvent('content_safe_area_changed', noInsets);
        }
        if (name === 'web_app_request_safe_area') {
          return emitEvent('safe_area_changed', noInsets);
        }
      },
      launchParams: new URLSearchParams([
        ['tgWebAppThemeParams', JSON.stringify(themeParams)],
        [
          'tgWebAppData',
          new URLSearchParams([
            ['auth_date', ((new Date().getTime() / 1000) | 0).toString()],
            ['hash', 'dev-mock-hash'],
            ['signature', 'dev-mock-signature'],
            [
              'user',
              JSON.stringify({
                id: mockUserId,
                first_name: 'Remy',
                last_name: 'Dev',
                username: 'remy_dev',
                language_code: 'en',
              }),
            ],
          ]).toString(),
        ],
        ['tgWebAppVersion', '8.4'],
        ['tgWebAppPlatform', 'tdesktop'],
      ]),
    });

    console.info(
      '[remy-webapp] Not running inside Telegram — dev environment mocked. This only applies in dev builds.',
    );
  }
}
