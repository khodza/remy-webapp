import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

import { Root } from '@/app/Root';
import { init } from '@/app/init';
import { EnvUnsupported } from '@/shared/ui';

import './index.css';
// Mock Telegram env in dev (outside Telegram). Import is an effectful module
// with a top-level await, so it resolves before any SDK call below.
import './app/mockEnv';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root element not found');
}
const root = ReactDOM.createRoot(container);

try {
  const launchParams = retrieveLaunchParams();
  const platform = launchParams.tgWebAppPlatform;
  const startParam = launchParams.tgWebAppStartParam ?? '';
  const debug = startParam.includes('debug') || import.meta.env.DEV;

  await init({
    debug,
    eruda: debug && ['ios', 'android'].includes(platform),
  });

  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
} catch (error) {
  // Silent fallback hid real bugs during tunnel testing — surface the error
  // to the console and to the fallback screen so we can diagnose.
  console.error('[remy-webapp] bootstrap failed:', error);
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
  root.render(<EnvUnsupported error={message} />);
}
