import { describe, expect, it } from 'vitest';
import type { Task } from '@/shared/api';
import { buildDay, buildWeek, dayKey, dayStart, minuteOfDay, shiftWeek } from './day';

const TZ = 'Asia/Tashkent'; // UTC+5
// Wed 17 Sep 2026, 14:47 in Tashkent.
const NOW = new Date('2026-09-17T09:47:00Z');
const local = (day: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 8, day, hh - 5, mm));

let seq = 0;
function task(due: Date | null, patch: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    description: `Task ${seq}`,
    notes: null,
    kind: due ? 'reminder' : 'todo',
    scheduledAt: due,
    timezone: TZ,
    snoozedUntil: null,
    nextFireAt: due,
    leadMinutes: null,
    status: 'pending',
    priority: 'normal',
    categoryId: null,
    recurrence: null,
    source: { type: 'text', originalText: null, messageId: null, forwardedFrom: null },
    completedAt: null,
    completionsCount: 0,
    snoozeCount: 0,
    isOverdue: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  } as Task;
}

describe('day keys', () => {
  it('uses the user zone', () => {
    // 22:00 UTC on the 17th is already the 18th in Tashkent.
    expect(dayKey(new Date('2026-09-17T22:00:00Z'), TZ)).toBe('2026-09-18');
    expect(dayStart('2026-09-18', TZ)?.toISOString()).toBe('2026-09-17T19:00:00.000Z');
    expect(dayStart('not a day', TZ)).toBeNull();
    expect(minuteOfDay(local(17, 14, 47), TZ)).toBe(14 * 60 + 47);
    expect(shiftWeek('2026-09-17', 1, TZ)).toBe('2026-09-24');
  });
});

describe('buildDay', () => {
  const yesterday = task(local(16, 18));
  const overdue = task(local(17, 11));
  const ahead = task(local(17, 15, 30));
  const tonight = task(local(17, 23, 30));
  const tomorrow = task(local(18, 10));
  const nextWeek = task(local(24, 10));
  const todo = task(null);
  const doneToday = task(local(17, 10), { status: 'completed', completedAt: local(17, 9, 52) });
  const doneEarlier = task(local(15, 10), { status: 'completed', completedAt: local(17, 8) });
  const doneYesterday = task(local(16, 10), { status: 'completed', completedAt: local(16, 10) });
  const pending = [tonight, ahead, overdue, yesterday, tomorrow, nextWeek, todo];
  const completed = [doneToday, doneEarlier, doneYesterday];

  it('splits today into overdue, later and done, with earlier overdue apart', () => {
    const day = buildDay(pending, completed, '2026-09-17', TZ, NOW);
    expect(day.isToday).toBe(true);
    expect(day.earlier.map((t) => t.id)).toEqual([yesterday.id]);
    expect(day.overdue.map((i) => i.task.id)).toEqual([overdue.id]);
    expect(day.later.map((i) => i.task.id)).toEqual([ahead.id, tonight.id]);
    expect(day.done.map((i) => i.task.id)).toEqual([doneEarlier.id, doneToday.id]);
    expect(day.tomorrow.map((t) => t.id)).toEqual([tomorrow.id]);
    expect(day.inboxCount).toBe(1);
    expect(day.next?.id).toBe(ahead.id);
  });

  it('places a done task at its planned time, or at completion when planned another day', () => {
    const day = buildDay(pending, completed, '2026-09-17', TZ, NOW);
    const at = Object.fromEntries(day.done.map((i) => [i.task.id, i.at.toISOString()]));
    expect(at[doneToday.id]).toBe(local(17, 10).toISOString());
    expect(at[doneEarlier.id]).toBe(local(17, 8).toISOString());
  });

  it('shows another day without the earlier-overdue list', () => {
    const day = buildDay(pending, completed, '2026-09-18', TZ, NOW);
    expect(day.isToday).toBe(false);
    expect(day.earlier).toEqual([]);
    expect(day.items.map((i) => i.task.id)).toEqual([tomorrow.id]);
    expect(day.next).toBeNull();
  });

  it('keeps a task that was just ticked off on the day as done, before the done list refetches', () => {
    const ticked = { ...overdue, status: 'completed' as const };
    const day = buildDay([ticked, ahead], [], '2026-09-17', TZ, NOW);
    expect(day.done.map((i) => i.task.id)).toEqual([overdue.id]);
    expect(day.overdue).toEqual([]);
    // Once the done list has it, it is not shown twice.
    const settled = buildDay([ticked], [{ ...ticked, completedAt: NOW }], '2026-09-17', TZ, NOW);
    expect(settled.done).toHaveLength(1);
  });

  it('uses the snooze time, not the series time', () => {
    const snoozed = task(local(17, 9), { snoozedUntil: local(17, 16), nextFireAt: local(17, 16) });
    const day = buildDay([snoozed], [], '2026-09-17', TZ, NOW);
    expect(day.later.map((i) => i.task.id)).toEqual([snoozed.id]);
  });
});

describe('buildWeek', () => {
  it('counts each day of the user week and flags overdue', () => {
    const week = buildWeek(
      [task(local(17, 11)), task(local(17, 18)), task(local(19, 9))],
      [task(local(15, 10), { status: 'completed', completedAt: local(15, 10) })],
      '2026-09-17',
      TZ,
      NOW,
      1,
    );
    expect(week.map((d) => d.key)).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
    ]);
    expect(week.map((d) => d.count)).toEqual([0, 1, 0, 2, 0, 1, 0]);
    expect(week[3]?.overdue).toBe(true);
    expect(week[5]?.overdue).toBe(false);
  });

  it('starts on Sunday when asked', () => {
    const week = buildWeek([], [], '2026-09-17', TZ, NOW, 0);
    expect(week[0]?.key).toBe('2026-09-13');
  });
});
