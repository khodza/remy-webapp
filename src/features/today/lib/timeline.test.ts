import { describe, expect, it } from 'vitest';
import { hourRange, layoutBlocks, snapMove } from './timeline';

describe('hourRange', () => {
  it('shows 06:00–24:00 by default', () => {
    expect(hourRange([600, 900], null)).toEqual([6, 24]);
  });

  it('stretches for an early reminder and for now after midnight', () => {
    expect(hourRange([5 * 60 + 30], null)).toEqual([5, 24]);
    expect(hourRange([600], 60 + 12)).toEqual([1, 24]);
  });

  it('never goes past midnight', () => {
    expect(hourRange([23 * 60 + 59], 23 * 60 + 50)).toEqual([6, 24]);
  });
});

describe('layoutBlocks', () => {
  // 60 px per hour from 06:00; full blocks 52 px, one-line blocks 26 px.
  const SIZE = { full: 52, min: 26, gap: 4 };
  const place = (minutes: Array<[string, number]>) =>
    Object.fromEntries(
      layoutBlocks(
        minutes.map(([id, minute]) => ({ id, minute })),
        6,
        60,
        SIZE,
      ).map((b) => [b.id, b]),
    );

  it('pins blocks to their minute at full height when there is room', () => {
    const blocks = place([
      ['a', 10 * 60],
      ['b', 13 * 60 + 30],
    ]);
    expect(blocks.a).toMatchObject({ top: 240, height: 52, column: 0, columns: 1 });
    expect(blocks.b).toMatchObject({ top: 450, height: 52, column: 0, columns: 1 });
  });

  it('makes a block thinner when the next one is close, instead of columns', () => {
    // 41 minutes apart: 37 px of room, full width.
    const blocks = place([
      ['a', 17 * 60 + 19],
      ['b', 18 * 60],
    ]);
    expect(blocks.a).toMatchObject({ height: 37, column: 0, columns: 1 });
    expect(blocks.b).toMatchObject({ height: 52, column: 0, columns: 1 });
  });

  it('puts blocks side by side only when they still collide', () => {
    const blocks = place([
      ['a', 600],
      ['b', 600],
      ['c', 615],
    ]);
    expect([blocks.a?.column, blocks.b?.column, blocks.c?.column]).toEqual([0, 1, 2]);
    expect(blocks.c?.columns).toBe(3);
    expect(blocks.a?.height).toBe(26);
  });

  it('starts a fresh cluster after a gap', () => {
    const blocks = place([
      ['a', 600],
      ['b', 610],
      ['c', 900],
    ]);
    expect(blocks.a?.columns).toBe(2);
    expect(blocks.c).toMatchObject({ column: 0, columns: 1 });
  });
});

describe('snapMove', () => {
  it('snaps to the quarter hour of the day, not to the drag distance', () => {
    // 14:47 dragged down 20 px (20 min) → 15:07 → snaps to 15:00.
    expect(snapMove(14 * 60 + 47, 20, 60)).toBe(13);
    expect(snapMove(600, 90, 60)).toBe(90);
    expect(snapMove(600, 5, 60)).toBe(0);
  });

  it('stays inside the day', () => {
    expect(snapMove(60, -500, 60)).toBe(-60);
    expect(snapMove(23 * 60, 500, 60)).toBe(45);
  });
});
