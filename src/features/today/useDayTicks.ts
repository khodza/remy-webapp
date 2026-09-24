import { useTasks } from '@/features/reminders';
import type { Task } from '@/shared/api';
import { dayKey, dueAt, minuteOfDay } from './lib/day';
import type { StripTick } from './components/LoadStrip';

const DONE_VARS = { view: 'done', limit: 100 } as const;

/** Ticks for the day `date` falls on, from the lists Today already loaded. */
export function useDayTicks(date: Date | null, tz: string, now: Date, extra?: Task): StripTick[] {
  const pending = useTasks();
  const done = useTasks(DONE_VARS);
  if (!date) return [];
  const key = dayKey(date, tz);
  const ticks: StripTick[] = [];
  const seen = new Set<string>();
  for (const task of [...(extra ? [extra] : []), ...(pending.data ?? [])]) {
    const due = task.status === 'pending' ? dueAt(task) : null;
    if (!due || seen.has(task.id) || dayKey(due, tz) !== key) continue;
    seen.add(task.id);
    ticks.push({
      id: task.id,
      minute: minuteOfDay(due, tz),
      tone: due.getTime() < now.getTime() ? 'danger' : 'accent',
    });
  }
  for (const task of done.data ?? []) {
    if (!task.completedAt || seen.has(task.id) || dayKey(task.completedAt, tz) !== key) continue;
    ticks.push({ id: task.id, minute: minuteOfDay(dueAt(task) ?? task.completedAt, tz), tone: 'ok' });
  }
  // Done occurrences of repeating tasks, on the day they were planned.
  for (const task of [...(extra ? [extra] : []), ...(pending.data ?? []), ...(done.data ?? [])]) {
    for (const completion of task.completions) {
      const id = `${task.id}@${completion.occurrenceAt.getTime()}`;
      if (seen.has(id) || dayKey(completion.occurrenceAt, tz) !== key) continue;
      if (task.completedAt && completion.at.getTime() === task.completedAt.getTime()) continue;
      seen.add(id);
      ticks.push({ id, minute: minuteOfDay(completion.occurrenceAt, tz), tone: 'ok' });
    }
  }
  return ticks;
}
