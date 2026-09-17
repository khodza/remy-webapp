// Opens an ngrok tunnel to the Vite dev server so Telegram (Web, Desktop and
// mobile on prod DC) can load the Mini App over HTTPS. Vite proxies /api to the
// local backend, so this one tunnel covers both. Run via `pnpm dev:ngrok`.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';
import ngrok from '@ngrok/ngrok';

const VITE_PORT = 5173;

// NGROK_* vars have no VITE_ prefix, so Vite never exposes them to the bundle.
if (existsSync('.env.local')) loadEnvFile('.env.local');

/** Falls back to the token saved by `ngrok config add-authtoken <token>`. */
function authtokenFromCliConfig() {
  const candidates = [
    join(homedir(), '.config', 'ngrok', 'ngrok.yml'),
    join(homedir(), '.ngrok2', 'ngrok.yml'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const match = /^\s*authtoken:\s*["']?([^"'\s]+)/m.exec(readFileSync(path, 'utf8'));
    if (match) return match[1];
  }
  return undefined;
}

const authtoken = process.env.NGROK_AUTHTOKEN || authtokenFromCliConfig();
if (!authtoken) {
  console.error(
    'No ngrok authtoken found. Copy yours from https://dashboard.ngrok.com/get-started/your-authtoken\n' +
      'and add this line to .env.local:  NGROK_AUTHTOKEN=<your token>',
  );
  process.exit(1);
}

const domain = process.env.NGROK_DOMAIN;
const listener = await ngrok.forward({
  addr: VITE_PORT,
  authtoken,
  ...(domain ? { domain } : {}),
});

console.log(`\nMini App URL: ${listener.url()}/`);
console.log(
  'This must match the URL in BotFather (Configure Mini App and Menu Button).\n',
);

// The listener doesn't hold the event loop open by itself; concurrently -k
// stops this process together with Vite.
setInterval(() => {}, 1 << 30);
