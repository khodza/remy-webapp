import { describe, expect, it } from 'vitest';
import { isCustomRecurrence, recurrenceLabel } from './recurrence';

describe('recurrenceLabel', () => {
  it.each([
    [{ type: 'daily' }, 'Every day'],
    [{ type: 'weekdays' }, 'Every weekday'],
    [{ type: 'weekly', byWeekday: [4, 1] }, 'Every Mon and Thu'],
    [{ type: 'weekly', byWeekday: [0, 6] }, 'Every Sat and Sun'],
    [{ type: 'weekly', interval: 2, byWeekday: [1, 3, 5] }, 'Every 2 weeks on Mon, Wed and Fri'],
    [{ type: 'monthly', lastDayOfMonth: true }, 'Last day of every month'],
    [{ type: 'every_n_days', intervalDays: 3 }, 'Every 3 days'],
    [{ type: 'yearly', interval: 2 }, 'Every 2 years'],
  ] as const)('%j → %s', (recurrence, label) => {
    expect(recurrenceLabel(recurrence as never, 'UTC')).toBe(label);
  });

  it('adds the end date in the user zone', () => {
    const recurrence = { type: 'daily', until: new Date('2026-12-31T20:00:00Z') } as const;
    expect(recurrenceLabel(recurrence as never, 'Asia/Tashkent')).toBe('Every day until 1 Jan 2027');
  });

  it('is null for one-shot tasks', () => {
    expect(recurrenceLabel(null)).toBeNull();
  });
});

describe('isCustomRecurrence', () => {
  it('flags rules the simple chips cannot express', () => {
    expect(isCustomRecurrence({ type: 'daily' } as never)).toBe(false);
    expect(isCustomRecurrence({ type: 'weekly', byWeekday: [1] } as never)).toBe(true);
    expect(isCustomRecurrence({ type: 'monthly', interval: 3 } as never)).toBe(true);
  });
});
