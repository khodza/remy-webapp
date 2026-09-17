import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/** Starts MSW. Only called when `VITE_MOCK_API=1` in a dev build. */
export async function startMockApi(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false,
  });
  console.info('[remy-webapp] Mock API enabled (MSW) — no backend calls will be made.');
}
