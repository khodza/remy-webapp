import type { Recurrence, RecurrenceInput } from '@/shared/api';
import { formatInTz, getDeviceTimezone } from '@/shared/lib/dates';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Monday-first, de-duplicated: reads naturally ("Mon and Thu", "Sat and Sun"). */
function orderedWeekdays(days: number[] | undefined): number[] {
  if (!days) return [];
  const order = (d: number) => (d === 0 ? 7 : d);
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => order(a) - order(b),
  );
}

function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Human label for a recurrence, worded like the bot ("Every Mon and Thu until
 * 31 Dec 2026"), or null for one-shot tasks.
 */
export function recurrenceLabel(
  recurrence: Recurrence | null | undefined,
  tz: string = getDeviceTimezone(),
): string | null {
  if (!recurrence) return null;
  const n = Math.max(1, Math.floor(recurrence.interval ?? 1));
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`);

  let label: string;
  switch (recurrence.type) {
    case 'daily':
      label = 'Every day';
      break;
    case 'weekdays':
      label = 'Every weekday';
      break;
    case 'weekly': {
      const days = orderedWeekdays(recurrence.byWeekday).map((d) => WEEKDAY_NAMES[d] ?? '?');
      if (days.length === 0) label = every('week');
      else label = n === 1 ? `Every ${listOf(days)}` : `Every ${n} weeks on ${listOf(days)}`;
      break;
    }
    case 'monthly':
      label = recurrence.lastDayOfMonth
        ? n === 1
          ? 'Last day of every month'
          : `Last day of every ${n} months`
        : every('month');
      break;
    case 'yearly':
      label = every('year');
      break;
    case 'every_n_days': {
      const d = Math.max(1, Math.floor(recurrence.intervalDays ?? 1));
      label = d === 1 ? 'Every day' : `Every ${d} days`;
      break;
    }
  }
  if (recurrence.until) label += ` until ${formatInTz(recurrence.until, tz, 'd MMM yyyy')}`;
  return label;
}

/**
 * True when the rule uses something the simple chips cannot express (it was
 * set in chat). The picker shows it read-only instead of flattening it.
 */
export function isCustomRecurrence(recurrence: Recurrence | null | undefined): boolean {
  if (!recurrence) return false;
  return (
    (recurrence.byWeekday?.length ?? 0) > 0 ||
    (recurrence.interval ?? 1) > 1 ||
    recurrence.lastDayOfMonth === true ||
    recurrence.until !== undefined
  );
}

/** Client recurrence (until: Date) → request body shape (until: ISO string). */
export function recurrenceToInput(recurrence: Recurrence): RecurrenceInput {
  const { until, ...rest } = recurrence;
  return { ...rest, ...(until ? { until: until.toISOString() } : {}) };
}
