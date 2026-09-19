import { defineConfig } from 'vitest/config';

// Pure-logic unit tests (dates, timeline layout, labels). Screens are
// checked in the browser against mock mode instead.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Tests pin their own zones; this makes "device zone" deterministic.
    env: { TZ: 'UTC' },
  },
});
