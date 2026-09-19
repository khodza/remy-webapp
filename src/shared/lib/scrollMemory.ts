/**
 * Scroll positions per history entry, so Back lands where you were (a
 * HashRouter + custom scroller gets no browser scroll restoration).
 */
const positions = new Map<string, number>();
const LIMIT = 50;

export function saveScroll(key: string, top: number): void {
  positions.delete(key);
  positions.set(key, top);
  if (positions.size > LIMIT) {
    const oldest = positions.keys().next().value;
    if (oldest !== undefined) positions.delete(oldest);
  }
}

export function savedScroll(key: string): number | undefined {
  return positions.get(key);
}
