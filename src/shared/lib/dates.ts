import { TZDate } from '@date-fns/tz';
import {
  addDays,
  differenceInMinutes,
  format,
  isSameDay,
  startOfDay,
} from 'date-fns';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useClockStore } from '@/shared/stores/clock.store';
import type { Task } from '@/shared/api/schemas';

/**
 * Every date the user sees or edits goes through these helpers with the
 * user's IANA timezone, never the browser's local zone (CLAUDE.md rule 4).
 * Pure functions live here so they can be unit-tested without React.
 *
 * Times follow the user's 12/24-hour setting: every time formatter takes
 * `hour12` as its last argument and defaults to the current preference
 * (`clockHour12()`), so tests pass it explicitly and screens need not.
 */

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The current 12/24-hour preference (default for every time formatter). */
export function clockHour12(): boolean {
  return useClockStore.getState().hour12;
}

/** Subscribes a component to the 12/24-hour preference. */
export function useHour12(): boolean {
  return useClockStore((s) => s.hour12);
}

/**
 * Profile timezone (kept in sync in the auth store), else the device zone.
 * Every component that formats a time calls this, so it also subscribes to
 * the 12/24-hour preference: switching it re-renders whatever shows a time.
 */
export function useUserTimezone(): string {
  const tz = useAuthStore((s) => s.user?.timezone ?? null);
  useHour12();
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

/**
 * When the reminder actually fires: a snooze overrides the series time.
 * Null for todos (no time at all).
 */
export function fireAt(task: Pick<Task, 'scheduledAt' | 'nextFireAt'>): Date | null {
  return task.nextFireAt ?? task.scheduledAt;
}

/** Sort key: earliest fire time first, todos (no time) last. */
export function compareByFireAt(
  a: Pick<Task, 'scheduledAt' | 'nextFireAt'>,
  b: Pick<Task, 'scheduledAt' | 'nextFireAt'>,
): number {
  const at = fireAt(a)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = fireAt(b)?.getTime() ?? Number.POSITIVE_INFINITY;
  return at - bt;
}

/** date-fns pattern for a time of day: "14:05" or "2:05 PM". */
export function timePattern(hour12: boolean = clockHour12()): string {
  return hour12 ? 'h:mm a' : 'HH:mm';
}

/** "14:05", or "2:05 PM" with the 12-hour clock. */
export function formatTime(
  date: Date | number,
  tz: string,
  hour12: boolean = clockHour12(),
): string {
  return formatInTz(date, tz, timePattern(hour12));
}

/** "Wed 17 Sep" */
export function formatDayShort(date: Date | number, tz: string): string {
  return formatInTz(date, tz, 'EEE d MMM');
}

/** "Wed 17 Sep · 14:05" */
export function formatDateTime(
  date: Date | number,
  tz: string,
  hour12: boolean = clockHour12(),
): string {
  return `${formatDayShort(date, tz)} · ${formatTime(date, tz, hour12)}`;
}

/** The time today, otherwise "Wed 17 Sep · 14:05". */
export function formatWhen(
  date: Date | number,
  tz: string,
  now: Date = new Date(),
  hour12: boolean = clockHour12(),
): string {
  return isTodayInTz(date, tz, now)
    ? formatTime(date, tz, hour12)
    : formatDateTime(date, tz, hour12);
}

/**
 * A wall-clock "HH:mm" as stored in settings (brief times, quiet hours):
 * "08:00" → "08:00", or "8:00 AM". Malformed input comes back unchanged.
 */
export function formatClock(
  hhmm: string,
  hour12: boolean = clockHour12(),
): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  if (h > 23) return hhmm;
  if (!hour12) return `${String(h).padStart(2, '0')}:${m[2]}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * An hour mark on a grid or bar (0–24): "09:00" / "24:00", or "9 AM" /
 * "12 AM" with the 12-hour clock.
 */
export function formatHour(
  hour: number,
  hour12: boolean = clockHour12(),
): string {
  if (!hour12) return `${String(hour).padStart(2, '0')}:00`;
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
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

/** Compact span for tight columns: "43 m", "3 h 47 m", "2 d". */
export function spanLabel(date: Date | number, now: Date = new Date()): string {
  const abs = Math.abs(differenceInMinutes(date, now));
  if (abs < 1) return 'now';
  if (abs >= 48 * 60) return `${Math.round(abs / (24 * 60))} d`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h === 0 ? `${m} m` : m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** "+05:00" style UTC offset of `tz` at `now`. */
export function utcOffsetLabel(tz: string, now: Date = new Date()): string {
  try {
    return formatInTz(now, tz, 'xxx');
  } catch {
    return '';
  }
}
