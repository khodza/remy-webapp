export const FIRST_NUDGE_OPTIONS = [10, 15, 30, 60] as const;
export const SECOND_NUDGE_OPTIONS = [60, 120, 180, 240] as const;
export const DEFAULT_FIRST_NUDGE = 30;

/** "30 m", "2 h" */
export function minutesLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} m`;
}

/** A second nudge that is not later than the first is dropped. */
export function nudgeSteps(first: number, second: number | null): number[] {
  return second !== null && second > first ? [first, second] : [first];
}

/** "30 m, then 2 h" */
export function nudgeSummary(steps: number[]): string {
  return steps.map(minutesLabel).join(', then ');
}

/** Minutes since midnight for "HH:mm". */
export function toMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** Quiet window as [start%, width%] segments on a 24 h bar (wraps midnight). */
export function quietSegments(from: string, to: string): Array<[number, number]> {
  const a = toMinutes(from);
  const b = toMinutes(to);
  const pct = (m: number) => (m / 1440) * 100;
  if (a === b) return [];
  if (a < b) return [[pct(a), pct(b - a)]];
  return [
    [pct(a), pct(1440 - a)],
    [0, pct(b)],
  ];
}
