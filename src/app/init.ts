import {
  backButton,
  init as initSDK,
  initData,
  miniApp,
  setDebug,
  swipeBehavior,
  themeParams,
  viewport,
} from '@telegram-apps/sdk-react';

export interface InitOptions {
  debug: boolean;
  eruda: boolean;
}

export async function init(options: InitOptions): Promise<void> {
  setDebug(options.debug);
  initSDK();

  if (options.eruda) {
    void import('eruda').then(({ default: eruda }) => {
      eruda.init();
      eruda.position({ x: window.innerWidth - 50, y: 0 });
    });
  }

  backButton.mount.ifAvailable();
  initData.restore();

  // mountSync is the v3-preferred sync path. The async `.mount()` returns a
  // promise and `bindCssVars()` would throw "component is unmounted" if we
  // didn't await it — bit us on real devices.
  if (themeParams.mountSync.isAvailable()) {
    themeParams.mountSync();
    themeParams.bindCssVars();
  }

  if (miniApp.mountSync.isAvailable()) {
    miniApp.mountSync();
    miniApp.bindCssVars();
  }

  // Viewport stays async — it genuinely queries the client for stable height
  // and safe-area insets.
  if (viewport.mount.isAvailable()) {
    await viewport.mount();
    viewport.bindCssVars();
  }

  // Mobile clients open Mini Apps at half height; ask for the full height so
  // lists are not cramped until the user drags the sheet up.
  viewport.expand.ifAvailable();

  // A vertical swipe on the page can collapse/close the Mini App on iOS.
  // Disabling it keeps scrolling inside the app.
  swipeBehavior.mount.ifAvailable();
  swipeBehavior.disableVertical.ifAvailable();

  // Tell Telegram the app is ready so its loading placeholder goes away at
  // first paint instead of on window load.
  miniApp.ready.ifAvailable();
}
