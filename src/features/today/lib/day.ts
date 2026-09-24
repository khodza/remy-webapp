import { TZDate } from '@date-fns/tz';
import { addDays, startOfWeek } from 'date-fns';
import type { Task } from '@/shared/api';
import { formatInTz, inTz, startOfDayInTz } from '@/shared/lib/dates';

/**
 * Pure grouping for the Today screen. Everything is decided in the user's
 * zone with an explicit `now`, so it is testable and never uses the
 * browser's midnight.
 */

/** "2026-09-17": a calendar day in the user's zone (the ?day= param). */
export type DayKey = string;

export function dayKey(date: Date | number, tz: string): DayKey {
  return formatInTz(date, tz, 'yyyy-MM-dd');
}

/** Midnight of `key` in `tz`, or null for a malformed key. */
export function dayStart(key: DayKey, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const date = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), tz);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
}

/** Midnight after `start` (23 or 25 hours later on DST days). */
export function nextDayStart(start: Date, tz: string): Date {
  const z = inTz(start, tz);
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate() + 1, tz).getTime());
}

/** When the task is due for the user: the snooze, else the series time. */
export function dueAt(task: Pick<Task, 'nextFireAt' | 'scheduledAt'>): Date | null {
  return task.nextFireAt ?? task.scheduledAt;
}

/** Wall-clock minutes since midnight in `tz` (DST-safe: 09:30 is 570). */
export function minuteOfDay(date: Date | number, tz: string): number {
  const z = inTz(date, tz);
  return z.getHours() * 60 + z.getMinutes();
}

const byDue = (a: Task, b: Task) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0);

export interface DayItem {
  /** Unique on the day: the task id, or `<id>@<occurrence>` for a done occurrence of a repeating task. */
  id: string;
  task: Task;
  /** Where it sits on the day: due time, or completion time when done off-day. */
  at: Date;
  state: 'overdue' | 'later' | 'done';
  /** When it was ticked (done items). */
  doneAt: Date | null;
  /**
   * A done occurrence of a repeating task whose series has moved on
   * (`task.completions`). There is nothing to reopen: the toast says when
   * the next one is.
   */
  occurrence: boolean;
}

export interface DayModel {
  /** Midnight of the selected day, and of the day after, in the user zone. */
  start: Date;
  end: Date;
  isToday: boolean;
  isPast: boolean;
  /** Overdue from before the selected day (only on today). */
  earlier: Task[];
  /** Everything placed on the selected day, by time. */
  items: DayItem[];
  overdue: DayItem[];
  later: DayItem[];
  done: DayItem[];
  /** Pending tasks due the day after (List view shows them on today). */
  tomorrow: Task[];
  inboxCount: number;
  /** First pending task still ahead today. */
  next: Task | null;
}

export function buildDay(pending: Task[], completed: Task[], selected: DayKey, tz: string, now: Date): DayModel {
  const start = dayStart(selected, tz) ?? startOfDayInTz(now, tz);
  const end = nextDayStart(start, tz);
  const todayStart = startOfDayInTz(now, tz);
  const isToday = start.getTime() === todayStart.getTime();
  const isPast = end.getTime() <= todayStart.getTime();
  const tomorrowEnd = nextDayStart(end, tz);
  const inDay = (t: number) => t >= start.getTime() && t < end.getTime();

  const earlier: Task[] = [];
  const items: DayItem[] = [];
  const tomorrow: Task[] = [];
  let inboxCount = 0;

  for (const task of pending) {
    if (task.status !== 'pending') continue;
    const due = dueAt(task);
    if (!due) {
      inboxCount += 1;
      continue;
    }
    const t = due.getTime();
    if (inDay(t)) {
      items.push({
        id: task.id,
        task,
        at: due,
        state: t < now.getTime() ? 'overdue' : 'later',
        doneAt: null,
        occurrence: false,
      });
    } else if (isToday && t < start.getTime()) earlier.push(task);
    else if (t >= end.getTime() && t < tomorrowEnd.getTime()) tomorrow.push(task);
  }

  // A task just ticked off is optimistically "completed" inside the pending
  // list until the done list refetches; without this it vanished and popped
  // back a moment later.
  const known = new Set(completed.map((task) => task.id));
  const justDone = pending.filter((task) => task.status === 'completed' && !known.has(task.id));
  for (const task of [...completed, ...justDone]) {
    if (task.status !== 'completed') continue;
    const completedAt = task.completedAt ?? (known.has(task.id) ? null : now);
    if (!completedAt || !inDay(completedAt.getTime())) continue;
    // A done block stays where it was planned when that was the same day.
    const planned = dueAt(task);
    const at = planned && inDay(planned.getTime()) ? planned : completedAt;
    items.push({ id: task.id, task, at, state: 'done', doneAt: completedAt, occurrence: false });
  }

  // Gap 1: Done on a repeating task advances the series instead of
  // completing it, so the occurrence that was ticked stays on its day as a
  // done item (the series' own done item covers a finished series).
  const seen = new Set<string>();
  for (const task of [...pending, ...completed]) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    for (const completion of task.completions) {
      if (!inDay(completion.occurrenceAt.getTime())) continue;
      if (task.completedAt && completion.at.getTime() === task.completedAt.getTime()) continue;
      items.push({
        id: `${task.id}@${completion.occurrenceAt.getTime()}`,
        task,
        at: completion.occurrenceAt,
        state: 'done',
        doneAt: completion.at,
        occurrence: true,
      });
    }
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  earlier.sort(byDue);
  tomorrow.sort(byDue);
  const later = items.filter((i) => i.state === 'later');
  return {
    start,
    end,
    isToday,
    isPast,
    earlier,
    items,
    overdue: items.filter((i) => i.state === 'overdue'),
    later,
    done: items.filter((i) => i.state === 'done'),
    tomorrow,
    inboxCount,
    next: isToday ? (later[0]?.task ?? null) : null,
  };
}

export interface CalendarDay {
  key: DayKey;
  /** Midnight in the user zone. */
  start: Date;
}

/** The calendar week (Mon–Sun or Sun–Sat) that contains `anchor`. */
export function weekDays(anchor: DayKey, tz: string, weekStartsOn: 0 | 1, now: Date = new Date()): CalendarDay[] {
  const start = dayStart(anchor, tz) ?? startOfDayInTz(now, tz);
  const first = startOfWeek(inTz(start, tz), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(new TZDate(first.getFullYear(), first.getMonth(), first.getDate() + i, tz).getTime());
    return { key: dayKey(day, tz), start: day };
  });
}

/**
 * `at` moved to another calendar day, keeping its wall-clock time in `tz`
 * (09:30 stays 09:30 across a DST change). Null for a malformed key.
 */
export function sameTimeOnDay(at: Date, key: DayKey, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const local = inTz(at, tz);
  const moved = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), local.getHours(), local.getMinutes(), tz);
  return Number.isNaN(moved.getTime()) ? null : new Date(moved.getTime());
}

export interface WeekDay {
  key: DayKey;
  start: Date;
  /** Reminders on the day, pending or done (dots). */
  count: number;
  overdue: boolean;
}

/** The seven days around `selected`, starting on the user's week start. */
export function buildWeek(
  pending: Task[],
  completed: Task[],
  selected: DayKey,
  tz: string,
  now: Date,
  weekStartsOn: 0 | 1,
): WeekDay[] {
  const days: WeekDay[] = weekDays(selected, tz, weekStartsOn, now).map((day) => ({
    ...day,
    count: 0,
    overdue: false,
  }));
  const index = new Map(days.map((d, i) => [d.key, i]));
  const bump = (date: Date, overdue: boolean) => {
    const i = index.get(dayKey(date, tz));
    const day = i === undefined ? undefined : days[i];
    if (!day) return;
    day.count += 1;
    if (overdue) day.overdue = true;
  };
  for (const task of pending) {
    const due = task.status === 'pending' ? dueAt(task) : null;
    if (due) bump(due, due.getTime() < now.getTime());
  }
  for (const task of completed) {
    if (task.status === 'completed' && task.completedAt) bump(task.completedAt, false);
  }
  // Done occurrences of repeating tasks count on the day they were planned.
  const seen = new Set<string>();
  for (const task of [...pending, ...completed]) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    for (const completion of task.completions) {
      if (task.completedAt && completion.at.getTime() === task.completedAt.getTime()) continue;
      bump(completion.occurrenceAt, false);
    }
  }
  return days;
}

/** The same weekday one week earlier or later. */
export function shiftWeek(key: DayKey, weeks: number, tz: string): DayKey {
  const start = dayStart(key, tz);
  if (!start) return key;
  return dayKey(addDays(inTz(start, tz), weeks * 7), tz);
}
