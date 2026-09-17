import { TZDate } from '@date-fns/tz';
import {
  addDays,
  differenceInMinutes,
  format,
  isSameDay,
  startOfDay,
} from 'date-fns';
import { useAuthStore } from '@/shared/stores/auth.store';
import type { Task } from '@/shared/api/schemas';

/**
 * Every date the user sees or edits goes through these helpers with the
 * user's IANA timezone, never the browser's local zone (CLAUDE.md rule 4).
 * Pure functions live here so they can be unit-tested without React.
 */

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Profile timezone (kept in sync in the auth store), else the device zone. */
export function useUserTimezone(): string {
  const tz = useAuthStore((s) => s.user?.timezone ?? null);
  return tz ?? getDeviceTimezone();
}

/** A Date whose calendar fields (getHours, getDate…) are read in `tz`. */
export function inTz(date: Date | number, tz: string): TZDate {
  return new TZDate(date instanceof Date ? date.getTime() : date, tz);
}

export function formatInTz(
  date: Date | number,
  tz: string,
  pattern: string,
): string {
  return format(inTz(date, tz), pattern);
}

export function startOfDayInTz(date: Date | number, tz: string): Date {
  return new Date(startOfDay(inTz(date, tz)).getTime());
}

export function isSameDayInTz(
  a: Date | number,
  b: Date | number,
  tz: string,
): boolean {
  return isSameDay(inTz(a, tz), inTz(b, tz));
}

export function isTodayInTz(
  date: Date | number,
  tz: string,
  now: Date = new Date(),
): boolean {
  return isSameDayInTz(date, now, tz);
}

export function isTomorrowInTz(
  date: Date | number,
  tz: string,
  now: Date = new Date(),
): boolean {
  return isSameDayInTz(date, addDays(inTz(now, tz), 1), tz);
}

/** `<input type="datetime-local">` value for `date` as wall-clock in `tz`. */
export function toLocalInputValue(date: Date | number, tz: string): string {
  return formatInTz(date, tz, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse a `datetime-local` value ("yyyy-MM-ddTHH:mm") as wall-clock time in
 * `tz` and return the absolute instant. Returns null for malformed input.
 */
export function fromLocalInputValue(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const zoned = new TZDate(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    tz,
  );
  const t = zoned.getTime();
  return Number.isNaN(t) ? null : new Date(t);
}

/** Same calendar day as `date` (in `tz`) at the given wall-clock time. */
export function atTimeInTz(
  date: Date | number,
  tz: string,
  hour: number,
  minute = 0,
): Date {
  const z = inTz(date, tz);
  return new Date(
    new TZDate(
      z.getFullYear(),
      z.getMonth(),
      z.getDate(),
      hour,
      minute,
      tz,
    ).getTime(),
  );
}

/** When the reminder actually fires: a snooze overrides the series time. */
export function fireAt(
  task: Pick<Task, 'scheduledAt'> & Partial<Pick<Task, 'nextFireAt'>>,
): Date {
  return task.nextFireAt ?? task.scheduledAt;
}

/** "HH:mm" */
export function formatTime(date: Date | number, tz: string): string {
  return formatInTz(date, tz, 'HH:mm');
}

/** "Wed 17 Sep" */
export function formatDayShort(date: Date | number, tz: string): string {
  return formatInTz(date, tz, 'EEE d MMM');
}

/** "HH:mm" today, otherwise "Wed 17 Sep · HH:mm". */
export function formatWhen(
  date: Date | number,
  tz: string,
  now: Date = new Date(),
): string {
  return isTodayInTz(date, tz, now)
    ? formatTime(date, tz)
    : `${formatDayShort(date, tz)} · ${formatTime(date, tz)}`;
}

/** "in 43 min", "in 3 h", "2 h 10 min late", "just now". */
export function relativeToNow(
  date: Date | number,
  now: Date = new Date(),
): string {
  const diff = differenceInMinutes(date, now);
  const abs = Math.abs(diff);
  if (abs < 1) return 'now';
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span =
    h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  if (abs >= 48 * 60) {
    const days = Math.round(abs / (24 * 60));
    return diff > 0 ? `in ${days} days` : `${days} days late`;
  }
  return diff > 0 ? `in ${span}` : `${span} late`;
}

/** "+05:00" style UTC offset of `tz` at `now`. */
export function utcOffsetLabel(tz: string, now: Date = new Date()): string {
  try {
    return formatInTz(now, tz, 'xxx');
  } catch {
    return '';
  }
}
