import { describe, expect, it } from 'vitest';
import {
  atTimeInTz,
  compareByFireAt,
  formatWhen,
  fromLocalInputValue,
  isTodayInTz,
  isTomorrowInTz,
  relativeToNow,
  startOfDayInTz,
  toLocalInputValue,
} from './dates';

const TASHKENT = 'Asia/Tashkent'; // UTC+5, no DST
const NY = 'America/New_York';

describe('wall clock in the user zone', () => {
  it('round-trips a datetime-local value', () => {
    const at = fromLocalInputValue('2026-09-17T09:30', TASHKENT);
    expect(at?.toISOString()).toBe('2026-09-17T04:30:00.000Z');
    expect(toLocalInputValue(at!, TASHKENT)).toBe('2026-09-17T09:30');
  });

  it('rejects malformed input', () => {
    expect(fromLocalInputValue('tomorrow', TASHKENT)).toBeNull();
  });

  it('keeps the wall clock across a DST change', () => {
    // New York leaves DST on 1 Nov 2026: 09:00 is 13:00Z before, 14:00Z after.
    expect(atTimeInTz(new Date('2026-10-31T15:00:00Z'), NY, 9).toISOString()).toBe('2026-10-31T13:00:00.000Z');
    expect(atTimeInTz(new Date('2026-11-02T15:00:00Z'), NY, 9).toISOString()).toBe('2026-11-02T14:00:00.000Z');
  });

  it('decides today and tomorrow by the user zone, not UTC', () => {
    const now = new Date('2026-09-17T20:00:00Z'); // 01:00 on the 18th in Tashkent
    // 10:00 on the 18th in Tashkent (today there), 01:00 on the 18th in New York (tomorrow there).
    const task = new Date('2026-09-18T05:00:00Z');
    expect(isTodayInTz(task, TASHKENT, now)).toBe(true);
    expect(isTodayInTz(task, NY, now)).toBe(false);
    expect(isTomorrowInTz(task, NY, now)).toBe(true);
    expect(startOfDayInTz(now, TASHKENT).toISOString()).toBe('2026-09-17T19:00:00.000Z');
  });

  it('formats today as a time and other days with the day', () => {
    const now = new Date('2026-09-17T06:00:00Z');
    expect(formatWhen(new Date('2026-09-17T09:47:00Z'), TASHKENT, now)).toBe('14:47');
    expect(formatWhen(new Date('2026-09-18T09:47:00Z'), TASHKENT, now)).toBe('Fri 18 Sep · 14:47');
  });
});

describe('relativeToNow', () => {
  const now = new Date('2026-09-17T10:00:00Z');
  it.each([
    ['2026-09-17T10:00:20Z', 'now'],
    ['2026-09-17T10:43:00Z', 'in 43 min'],
    ['2026-09-17T13:00:00Z', 'in 3 h'],
    ['2026-09-17T07:50:00Z', '2 h 10 min late'],
    ['2026-09-20T10:00:00Z', 'in 3 days'],
  ])('%s → %s', (at, label) => {
    expect(relativeToNow(new Date(at), now)).toBe(label);
  });
});

describe('compareByFireAt', () => {
  it('puts a snooze time over the series time and todos last', () => {
    const series = { scheduledAt: new Date('2026-09-17T08:00:00Z'), nextFireAt: new Date('2026-09-17T11:00:00Z') };
    const plain = { scheduledAt: new Date('2026-09-17T09:00:00Z'), nextFireAt: null };
    const todo = { scheduledAt: null, nextFireAt: null };
    expect([todo, series, plain].sort(compareByFireAt)).toEqual([plain, series, todo]);
  });
});
