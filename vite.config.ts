import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    process.env.HTTPS ? mkcert() : undefined,
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    // Telegram opens the app in the system WebView: WebKit on iOS (Telegram
    // supports iOS 15+ in practice), Android System WebView (Chromium,
    // updated through the Play Store, but some devices lag years behind).
    // ES2022 syntax with Safari 15 as the floor; anything newer is lowered.
    // A top-level await would fail this target at build time (F26).
    target: ['es2022', 'safari15', 'chrome100'],
    minify: 'terser',
  },
  server: {
    host: true,
    port: 5173,
    // A leading dot matches any subdomain: `pnpm dev:tunnel` gets a random
    // trycloudflare.com one each run. ngrok now gives free accounts a
    // *.ngrok-free.dev domain (older ones got *.ngrok-free.app); paid plans
    // use *.ngrok.app / *.ngrok.dev. Add other providers here if you switch.
    allowedHosts: [
      '.trycloudflare.com',
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok.dev',
      '.ngrok.io',
    ],
    // Vite enables this under coding agents. Its client then calls ws.send()
    // before the HMR socket is open, so every console.error/warn throws until
    // it connects — instant on localhost, but over a slow tunnel it broke app
    // startup. The dev:* tunnel scripts set TUNNEL=1.
    forwardConsole: process.env.TUNNEL ? false : undefined,
    // Forward /api/* to the local NestJS backend. With this + the frontend
    // tunnel, the Mini App can call the API same-origin (no CORS, no need
    // to tunnel the backend separately).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
