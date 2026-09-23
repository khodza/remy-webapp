import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

import { Root } from '@/app/Root';
import { DEBUG_TOOLS, init } from '@/app/init';
import { EnvUnsupported } from '@/shared/ui';

import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root element not found');
}
const root = ReactDOM.createRoot(container);

// No top-level await: older Telegram WebViews (Safari < 15, old Android
// System WebView) cannot parse it (F26). Boot is one async function.
async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV) {
    // Outside Telegram, fake it before any SDK call. Dynamic imports inside
    // a DEV branch keep the mock env, msw and the fixtures out of
    // production bundles.
    const { mockTelegramEnvIfNeeded } = await import('@/app/mockEnv');
    await mockTelegramEnvIfNeeded();
    if (import.meta.env.VITE_MOCK_API === '1') {
      const { startMockApi } = await import('@/mocks/browser');
      await startMockApi();
    }
  }

  const launchParams = retrieveLaunchParams();
  const platform = launchParams.tgWebAppPlatform;

  // Debug logging and eruda are build-time decisions (dev, or a build with
  // VITE_DEBUG_TOOLS=1), never a start param anyone can type (F25).
  await init({
    debug: DEBUG_TOOLS,
    eruda: DEBUG_TOOLS && ['ios', 'android'].includes(platform),
  });

  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

bootstrap().catch((error: unknown) => {
  // Silent fallback hid real bugs during tunnel testing — surface the error
  // to the console and to the fallback screen so we can diagnose.
  console.error('[remy-webapp] bootstrap failed:', error);
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
  root.render(<EnvUnsupported error={message} />);
});
