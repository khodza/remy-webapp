import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals, so Testing Library cannot register its own
// cleanup: unmount after every test by hand.
afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // no storage in this environment
  }
});
