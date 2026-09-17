import { HttpResponse, delay, http } from 'msw';
import { addDays, addMinutes, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';
import type { Recurrence } from '@/shared/api';
import {
  buildFixtures,
  mockUser,
  newId,
  nextFireAt,
  type MockTask,
} from './fixtures';

/**
 * MSW handlers for every endpoint in src/shared/api. Response shapes mirror
 * the backend DTOs (see src/shared/api/schemas.ts): ISO strings for dates,
 * `isOverdue` only on list items, `{ tasks }` for the list, `{ success }` on
 * delete, `{ token, expiresAt, user }` on auth.
 */

const API = '*/api/v1';
const LATENCY_MS = 250;

let tasks: MockTask[] = buildFixtures();
let user = { ...mockUser };

function toDto(task: MockTask, withOverdue = false) {
  const fire = nextFireAt(task);
  const dto: Record<string, unknown> = {
    id: task.id,
    description: task.description,
    scheduledAt: task.scheduledAt.toISOString(),
    status: task.status,
    recurrence: task.recurrence,
    timezone: task.timezone,
    snoozedUntil: task.snoozedUntil ? task.snoozedUntil.toISOString() : null,
    nextFireAt: fire.toISOString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
  if (withOverdue) {
    dto['isOverdue'] = task.status === 'pending' && fire.getTime() < Date.now();
  }
  return dto;
}

function isValidObjectId(id: string | undefined): id is string {
  return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json({ statusCode: status, error: code, message }, { status });
}

function find(id: string | readonly string[] | undefined): MockTask | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return tasks.find((t) => t.id === key && t.status !== 'deleted');
}

function touch(task: MockTask): MockTask {
  task.updatedAt = new Date();
  return task;
}

/** Tiny stand-in for the AI parser: "tomorrow" → tomorrow 09:00, else +1h. */
function fakeParse(text: string): {
  description: string;
  scheduledAt: Date;
  recurrence: Recurrence | null;
} {
  const lower = text.toLowerCase();
  const now = new Date();
  const nine = (d: Date) => setSeconds(setMinutes(setHours(d, 9), 0), 0);
  const scheduledAt = lower.includes('tomorrow')
    ? nine(addDays(startOfDay(now), 1))
    : addMinutes(now, 60);
  let recurrence: Recurrence | null = null;
  if (/every day|daily/.test(lower)) recurrence = { type: 'daily' };
  else if (/weekdays?/.test(lower)) recurrence = { type: 'weekdays' };
  else if (/every week|weekly/.test(lower)) recurrence = { type: 'weekly' };
  else if (/every month|monthly/.test(lower)) recurrence = { type: 'monthly' };
  const description = text
    .replace(/\b(remind me to|tomorrow|today|every (day|week|month)|daily|weekly|monthly|weekdays?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { description: description || text.trim(), scheduledAt, recurrence };
}

export const handlers = [
  http.post(`${API}/auth/telegram`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = request.headers.get('authorization') ?? '';
    if (!auth.startsWith('tma ')) {
      return error(401, 'UNAUTHORIZED', 'Missing tma initData');
    }
    return HttpResponse.json({
      token: 'mock-jwt-token',
      expiresAt: addMinutes(new Date(), 15).toISOString(),
      user,
    });
  }),

  http.get(`${API}/user/me`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(user);
  }),

  http.patch(`${API}/user/timezone`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json()) as { timezone?: string };
    if (!body.timezone) return error(400, 'BAD_REQUEST', 'timezone is required');
    user = { ...user, timezone: body.timezone };
    return HttpResponse.json(user);
  }),

  http.get(`${API}/tasks`, async ({ request }) => {
    await delay(LATENCY_MS);
    const includeCompleted =
      new URL(request.url).searchParams.get('includeCompleted') === 'true';
    const list = tasks
      .filter((t) => t.status !== 'deleted')
      .filter((t) => includeCompleted || t.status !== 'completed')
      .sort((a, b) => nextFireAt(a).getTime() - nextFireAt(b).getTime());
    return HttpResponse.json({ tasks: list.map((t) => toDto(t, true)) });
  }),

  http.get(`${API}/tasks/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const id = Array.isArray(params['id']) ? params['id'][0] : params['id'];
    if (!isValidObjectId(id)) {
      return error(400, 'BAD_REQUEST', 'Validation failed (ObjectId is expected)');
    }
    const task = find(id);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    return HttpResponse.json(toDto(task, true));
  }),

  http.post(`${API}/tasks`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) return error(400, 'BAD_REQUEST', 'text is required');
    const parsed = fakeParse(text);
    const now = new Date();
    const task: MockTask = {
      id: newId(),
      description: parsed.description,
      scheduledAt: parsed.scheduledAt,
      status: 'pending',
      recurrence: parsed.recurrence,
      timezone: user.timezone ?? 'UTC',
      snoozedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    tasks = [...tasks, task];
    return HttpResponse.json(toDto(task), { status: 201 });
  }),

  http.post(`${API}/tasks/voice`, async () => {
    await delay(LATENCY_MS * 4);
    const now = new Date();
    const task: MockTask = {
      id: newId(),
      description: 'Voice memo (mock transcription)',
      scheduledAt: addMinutes(now, 60),
      status: 'pending',
      recurrence: null,
      timezone: user.timezone ?? 'UTC',
      snoozedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    tasks = [...tasks, task];
    return HttpResponse.json(toDto(task), { status: 201 });
  }),

  http.patch(`${API}/tasks/:id`, async ({ params, request }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    const body = (await request.json()) as {
      description?: string;
      scheduledAt?: string;
      recurrence?: Recurrence | null;
    };
    if (body.description !== undefined) task.description = body.description;
    if (body.scheduledAt !== undefined) {
      task.scheduledAt = new Date(body.scheduledAt);
      task.snoozedUntil = null; // an explicit reschedule replaces any snooze
    }
    if (body.recurrence !== undefined) task.recurrence = body.recurrence;
    return HttpResponse.json(toDto(touch(task)));
  }),

  http.post(`${API}/tasks/:id/complete`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    if (task.recurrence) {
      // Recurring tasks advance one day (mock approximation) and clear snooze.
      task.scheduledAt = addDays(task.scheduledAt, 1);
      task.snoozedUntil = null;
    } else {
      task.status = 'completed';
    }
    return HttpResponse.json(toDto(touch(task)));
  }),

  http.post(`${API}/tasks/:id/delay`, async ({ params, request }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    const body = (await request.json()) as { minutes?: number };
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes < 1) {
      return error(400, 'BAD_REQUEST', 'minutes must be a positive integer');
    }
    // Same rule as the backend: overdue tasks snooze from now, others from
    // their (current) fire time. A recurring task keeps its series time and
    // gets a one-off snoozedUntil instead.
    const base = Math.max(nextFireAt(task).getTime(), Date.now());
    const until = addMinutes(new Date(base), minutes);
    if (task.recurrence) task.snoozedUntil = until;
    else task.scheduledAt = until;
    return HttpResponse.json(toDto(touch(task)));
  }),

  http.delete(`${API}/tasks/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    task.status = 'deleted';
    touch(task);
    return HttpResponse.json({ success: true });
  }),

  http.post(`${API}/ai/parse`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) return error(400, 'BAD_REQUEST', 'text is required');
    const parsed = fakeParse(text);
    return HttpResponse.json({
      description: parsed.description,
      scheduledAt: parsed.scheduledAt.toISOString(),
      recurrence: parsed.recurrence,
    });
  }),
];
