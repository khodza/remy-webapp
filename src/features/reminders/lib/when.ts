import { addDays, addMinutes, nextMonday, nextSaturday } from 'date-fns';
import { atTimeInTz, formatDateTime, formatTime, inTz, isTodayInTz, isTomorrowInTz } from '@/shared/lib/dates';

/**
 * Pure time choices shared by Detail, Catch-up and Create. Every option
 * carries the exact instant it resolves to, so chips can show "15:47"
 * under "+1h" and the app never sends a different time than it showed.
 */

export interface SnoozeOption {
  key: string;
  label: string;
  at: Date;
  /** delay = minutes from max(due, now) (server rule); until = absolute. */
  action: { kind: 'delay'; minutes: number } | { kind: 'until'; until: Date };
}

/** +15m, +1h, Tonight (or Tomorrow), Tomorrow (or Next week). */
export function snoozeOptions(due: Date | null, now: Date, tz: string): SnoozeOption[] {
  const from = due && due.getTime() > now.getTime() ? due : now;
  const options: SnoozeOption[] = [
    { key: '15m', label: '+15m', at: addMinutes(from, 15), action: { kind: 'delay', minutes: 15 } },
    { key: '1h', label: '+1h', at: addMinutes(from, 60), action: { kind: 'delay', minutes: 60 } },
  ];
  const later = (at: Date) => at.getTime() > addMinutes(from, 60).getTime();
  const until = (key: string, label: string, at: Date) => {
    if (later(at) && !options.some((o) => o.at.getTime() === at.getTime())) {
      options.push({ key, label, at, action: { kind: 'until', until: at } });
    }
  };
  until('tonight', 'Tonight', atTimeInTz(now, tz, 20));
  // Before 05:00 "tomorrow morning" is really this morning.
  const earlyHours = inTz(now, tz).getHours() < 5;
  until(
    'morning',
    earlyHours ? 'Morning' : 'Tomorrow',
    atTimeInTz(earlyHours ? now : addDays(inTz(now, tz), 1), tz, 9),
  );
  until('next-week', 'Next week', atTimeInTz(nextMonday(inTz(now, tz)), tz, 9));
  return options.slice(0, 4);
}

export interface QuickTime {
  key: string;
  label: string;
  at: Date;
}

/** Suggestions at the top of the When sheet. */
export function quickTimes(now: Date, tz: string): QuickTime[] {
  const local = inTz(now, tz);
  const inAnHour = addMinutes(now, 60);
  // Round up to the next 5 minutes: "15:50", not "15:47".
  const rounded = new Date(Math.ceil(inAnHour.getTime() / 300_000) * 300_000);
  const times: QuickTime[] = [{ key: 'hour', label: 'In an hour', at: rounded }];
  const evening = atTimeInTz(now, tz, 20);
  if (evening.getTime() > rounded.getTime()) times.push({ key: 'evening', label: 'This evening', at: evening });
  times.push({ key: 'tomorrow', label: 'Tomorrow morning', at: atTimeInTz(addDays(local, 1), tz, 9) });
  const weekend = local.getDay() === 6 || local.getDay() === 0 ? 'Next weekend' : 'This weekend';
  times.push({ key: 'weekend', label: weekend, at: atTimeInTz(nextSaturday(local), tz, 10) });
  times.push({ key: 'week', label: 'Next week', at: atTimeInTz(nextMonday(local), tz, 9) });
  // On a Sunday "Tomorrow morning" and "Next week" are the same Monday 09:00.
  return times.filter((time, i) => times.findIndex((other) => other.at.getTime() === time.at.getTime()) === i);
}

/** "Today 11:00", "Tomorrow 10:00", "Wed 24 Sep · 10:00" (in the user's clock format). */
export function describeDue(at: Date, tz: string, now: Date): string {
  if (isTodayInTz(at, tz, now)) return `Today ${formatTime(at, tz)}`;
  if (isTomorrowInTz(at, tz, now)) return `Tomorrow ${formatTime(at, tz)}`;
  return formatDateTime(at, tz);
}

export const LEAD_CHOICES: Array<number | null> = [null, 5, 10, 15, 30, 60, 120, 1440];

/** "At the time", "30 min before", "2 h before", "1 day before". */
export function leadLabel(minutes: number | null): string {
  if (minutes === null) return 'At the time';
  if (minutes % 1440 === 0) return minutes === 1440 ? '1 day before' : `${minutes / 1440} days before`;
  if (minutes % 60 === 0) return `${minutes / 60} h before`;
  return `${minutes} min before`;
}
