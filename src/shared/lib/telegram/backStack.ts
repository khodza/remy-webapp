import { backButton } from '@telegram-apps/sdk-react';

/**
 * Telegram has one Back button, but a page and a sheet on top of it both
 * want it. Handlers form a stack: the top one runs, and the button is
 * visible while the stack is not empty. The root page pushes nothing.
 */
type Entry = { id: number; handler: () => void };

const stack: Entry[] = [];
const listeners = new Set<() => void>();
let seq = 0;
let unsubscribe: (() => void) | null = null;

function sync(): void {
  const visible = stack.length > 0;
  if (backButton.isMounted()) {
    if (visible) backButton.show();
    else backButton.hide();
    if (visible && !unsubscribe) {
      unsubscribe = backButton.onClick(triggerBack);
    } else if (!visible && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }
  listeners.forEach((listener) => listener());
}

/** Registers a handler on top; returns the function that removes it. */
export function pushBack(handler: () => void): () => void {
  const entry = { id: ++seq, handler };
  stack.push(entry);
  sync();
  return () => {
    const index = stack.findIndex((e) => e.id === entry.id);
    if (index >= 0) stack.splice(index, 1);
    sync();
  };
}

export function triggerBack(): void {
  stack[stack.length - 1]?.handler();
}

export function isBackVisible(): boolean {
  return stack.length > 0;
}

/** For the dev chrome that mirrors the button outside Telegram. */
export function subscribeBack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
