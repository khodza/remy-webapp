/**
 * Hour-grid geometry for the Timeline view. Reminders are moments, not
 * durations: a block is drawn full height when there is room before the
 * next one, gets thinner (one line) when the next is close, and only
 * shares the row in columns when two would still collide.
 */

export const DEFAULT_FIRST_HOUR = 6;
export const DEFAULT_LAST_HOUR = 24;

/**
 * Visible hours: 06:00–24:00, stretched to show an early or late
 * reminder and, on today, the current time.
 */
export function hourRange(minutes: number[], nowMinute: number | null): [number, number] {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  for (const m of nowMinute === null ? minutes : [...minutes, nowMinute]) {
    first = Math.min(first, Math.floor(m / 60));
    last = Math.max(last, Math.min(24, Math.floor(m / 60) + 1));
  }
  return [Math.max(0, first), last];
}

export interface BlockInput {
  id: string;
  /** Minutes since midnight. */
  minute: number;
}

export interface PlacedBlock {
  id: string;
  top: number;
  height: number;
  column: number;
  columns: number;
}

export interface BlockSize {
  /** Full height: title and a meta line. */
  full: number;
  /** One-line height; below this blocks go side by side. */
  min: number;
  /** Space kept between stacked blocks. */
  gap: number;
}

export function layoutBlocks(blocks: BlockInput[], firstHour: number, hourPx: number, size: BlockSize): PlacedBlock[] {
  const sorted = [...blocks].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
  const tops = sorted.map((b) => ((b.minute - firstHour * 60) / 60) * hourPx);

  const placed: PlacedBlock[] = [];
  let cluster: PlacedBlock[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    for (const block of cluster) block.columns = columnEnds.length;
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };

  sorted.forEach((block, i) => {
    const top = tops[i] ?? 0;
    // Room until the next later block decides how tall this one can be.
    const nextTop = tops.slice(i + 1).find((t) => t > top);
    const room = nextTop === undefined ? Infinity : nextTop - top - size.gap;
    const height = Math.max(size.min, Math.min(size.full, room));

    if (top >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((end) => end <= top);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = top + height + size.gap;
    clusterEnd = Math.max(clusterEnd, top + height + size.gap);
    const entry = { id: block.id, top, height, column, columns: 1 };
    cluster.push(entry);
    placed.push(entry);
  });
  closeCluster();
  return placed;
}
