import { afterEach, describe, expect, it } from 'vitest';
import { setClockHour12 } from '@/shared/stores/clock.store';
import {
  atTimeInTz,
  clockHour12,
  compareByFireAt,
  formatClock,
  formatDateTime,
  formatHour,
  formatTime,
  formatWhen,
  timePattern,
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

describe('12/24-hour time format', () => {
  afterEach(() => setClockHour12(false));
  const afternoon = new Date('2026-09-17T09:47:00Z'); // 14:47 in Tashkent
  const morning = new Date('2026-09-17T04:05:00Z'); // 09:05
  const midnight = new Date('2026-09-16T19:00:00Z'); // 00:00
  const noon = new Date('2026-09-17T07:00:00Z'); // 12:00

  it('formats a time either way', () => {
    expect(formatTime(afternoon, TASHKENT, false)).toBe('14:47');
    expect(formatTime(afternoon, TASHKENT, true)).toBe('2:47 PM');
    expect(formatTime(morning, TASHKENT, false)).toBe('09:05');
    expect(formatTime(morning, TASHKENT, true)).toBe('9:05 AM');
    expect(formatTime(midnight, TASHKENT, true)).toBe('12:00 AM');
    expect(formatTime(noon, TASHKENT, true)).toBe('12:00 PM');
    expect(timePattern(true)).toBe('h:mm a');
  });

  it('reads the zone before the clock: the same instant in New York', () => {
    expect(formatTime(afternoon, NY, true)).toBe('5:47 AM');
    expect(formatTime(afternoon, NY, false)).toBe('05:47');
  });

  it('carries the format into date + time and "when" labels', () => {
    const now = new Date('2026-09-17T06:00:00Z');
    expect(formatDateTime(afternoon, TASHKENT, true)).toBe('Thu 17 Sep · 2:47 PM');
    expect(formatWhen(afternoon, TASHKENT, now, true)).toBe('2:47 PM');
    expect(formatWhen(new Date('2026-09-18T09:47:00Z'), TASHKENT, now, true)).toBe('Fri 18 Sep · 2:47 PM');
  });

  it('formats settings wall-clock strings', () => {
    expect(formatClock('08:00', false)).toBe('08:00');
    expect(formatClock('8:30', false)).toBe('08:30');
    expect(formatClock('08:00', true)).toBe('8:00 AM');
    expect(formatClock('21:30', true)).toBe('9:30 PM');
    expect(formatClock('00:15', true)).toBe('12:15 AM');
    expect(formatClock('12:00', true)).toBe('12:00 PM');
    expect(formatClock('nonsense', true)).toBe('nonsense');
    expect(formatClock('25:00', true)).toBe('25:00');
  });

  it('labels hour marks, including both ends of the day', () => {
    expect(formatHour(6, false)).toBe('06:00');
    expect(formatHour(24, false)).toBe('24:00');
    expect(formatHour(0, true)).toBe('12 AM');
    expect(formatHour(6, true)).toBe('6 AM');
    expect(formatHour(12, true)).toBe('12 PM');
    expect(formatHour(18, true)).toBe('6 PM');
    expect(formatHour(24, true)).toBe('12 AM');
  });

  it('defaults to the stored preference', () => {
    expect(clockHour12()).toBe(false);
    expect(formatTime(afternoon, TASHKENT)).toBe('14:47');
    setClockHour12(true);
    expect(clockHour12()).toBe(true);
    expect(formatTime(afternoon, TASHKENT)).toBe('2:47 PM');
    expect(formatClock('20:00')).toBe('8:00 PM');
  });
});
