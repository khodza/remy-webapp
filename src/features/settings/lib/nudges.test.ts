import { describe, expect, it } from 'vitest';
import { nudgeSteps, nudgeSummary, quietSegments } from './nudges';

describe('nudges', () => {
  it('drops a second nudge that is not later', () => {
    expect(nudgeSteps(30, 120)).toEqual([30, 120]);
    expect(nudgeSteps(60, 60)).toEqual([60]);
    expect(nudgeSteps(30, null)).toEqual([30]);
    expect(nudgeSummary([30, 120])).toBe('30 m, then 2 h');
  });
});

describe('quietSegments', () => {
  it('wraps a window over midnight into two segments', () => {
    const [late, early] = quietSegments('23:00', '07:00');
    expect(late?.[0]).toBeCloseTo(95.83, 1);
    expect(late?.[1]).toBeCloseTo(4.17, 1);
    expect(early).toEqual([0, (7 / 24) * 100]);
  });

  it('keeps a same-day window whole and ignores an empty one', () => {
    expect(quietSegments('13:00', '14:00')).toEqual([[(13 / 24) * 100, (1 / 24) * 100]]);
    expect(quietSegments('08:00', '08:00')).toEqual([]);
  });
});
