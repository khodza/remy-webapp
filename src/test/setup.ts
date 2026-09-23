import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout: scrolling is a no-op the screens can call safely.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}

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
