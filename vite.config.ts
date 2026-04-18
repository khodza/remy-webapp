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
    target: 'esnext',
    minify: 'terser',
  },
  server: {
    host: true,
    port: 5173,
    // `.trycloudflare.com` matches any subdomain — `pnpm dev:tunnel` picks a
    // random one each run. Add other providers here if you switch tunnels.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
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
