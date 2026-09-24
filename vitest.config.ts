import { defineConfig } from 'vitest/config';
import { version } from './package.json';

// Two projects: pure logic (*.test.ts, node) and components / hooks
// (*.test.tsx, jsdom + Testing Library). Whole flows are checked in a real
// browser by `pnpm smoke` against mock mode.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    // Tests pin their own zones; this makes "device zone" deterministic.
    env: { TZ: 'UTC' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
});
