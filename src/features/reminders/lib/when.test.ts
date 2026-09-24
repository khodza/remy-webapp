import { describe, expect, it } from 'vitest';
import { describeDue, leadLabel, quickTimes, snoozeOptions } from './when';

const TZ = 'Asia/Tashkent'; // UTC+5
const local = (day: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 8, day, hh - 5, mm));
const NOW = local(17, 14, 47); // Wed 17 Sep, 14:47
const at = (options: Array<{ key: string; at: Date }>) =>
  Object.fromEntries(options.map((o) => [o.key, o.at.toISOString()]));

describe('snoozeOptions', () => {
  it('counts from now for an overdue task and shows the resulting times', () => {
    const options = snoozeOptions(local(17, 11), NOW, TZ);
    expect(options.map((o) => o.label)).toEqual(['+15m', '+1h', 'Tonight', 'Tomorrow']);
    expect(at(options)).toEqual({
      '15m': local(17, 15, 2).toISOString(),
      '1h': local(17, 15, 47).toISOString(),
      tonight: local(17, 20).toISOString(),
      morning: local(18, 9).toISOString(),
    });
  });

  it('counts from the due time when it is still ahead', () => {
    const [plus15] = snoozeOptions(local(17, 16), NOW, TZ);
    expect(plus15?.at.toISOString()).toBe(local(17, 16, 15).toISOString());
  });

  it('drops Tonight late in the evening', () => {
    const options = snoozeOptions(null, local(17, 21, 30), TZ);
    expect(options.map((o) => o.label)).toEqual(['+15m', '+1h', 'Tomorrow', 'Next week']);
  });

  it('calls 09:00 "Morning" after midnight', () => {
    const options = snoozeOptions(null, local(18, 1), TZ);
    expect(options.find((o) => o.key === 'morning')).toMatchObject({ label: 'Morning', at: local(18, 9) });
  });
});

describe('quickTimes', () => {
  it('rounds "in an hour" and skips the evening once it has passed', () => {
    expect(at(quickTimes(NOW, TZ))).toEqual({
      hour: local(17, 15, 50).toISOString(),
      evening: local(17, 20).toISOString(),
      tomorrow: local(18, 9).toISOString(),
      weekend: local(19, 10).toISOString(),
      week: local(21, 9).toISOString(),
    });
    expect(quickTimes(local(17, 19, 30), TZ).map((q) => q.key)).not.toContain('evening');
  });

  it('never offers the same moment twice (Sunday: tomorrow morning is next week)', () => {
    const sunday = quickTimes(local(20, 18, 30), TZ);
    expect(sunday.map((q) => q.key)).toEqual(['hour', 'evening', 'tomorrow', 'weekend']);
  });
});

describe('labels', () => {
  it('describes a due time relative to today', () => {
    expect(describeDue(local(17, 11), TZ, NOW)).toBe('Today 11:00');
    expect(describeDue(local(18, 10), TZ, NOW)).toBe('Tomorrow 10:00');
    expect(describeDue(local(24, 10), TZ, NOW)).toBe('Thu 24 Sep · 10:00');
  });

  it('names lead times', () => {
    expect([null, 30, 120, 1440, 2880].map(leadLabel)).toEqual([
      'At the time',
      '30 min before',
      '2 h before',
      '1 day before',
      '2 days before',
    ]);
  });
});
