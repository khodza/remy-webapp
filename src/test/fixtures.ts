import type { Task } from '@/shared/api';

let seq = 0;

/** A pending one-off reminder; override anything. */
export function makeTask(patch: Partial<Task> = {}): Task {
  seq += 1;
  const at = new Date('2026-09-23T09:00:00Z');
  return {
    id: `task-${seq}`,
    description: `Task ${seq}`,
    notes: null,
    kind: 'reminder',
    scheduledAt: at,
    timezone: 'UTC',
    snoozedUntil: null,
    nextFireAt: at,
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
    createdAt: at,
    updatedAt: at,
    ...patch,
  } as Task;
}
