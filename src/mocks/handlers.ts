import { HttpResponse, delay, http } from 'msw';
import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  lastDayOfMonth,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import type { Category, Recurrence, RecurrenceInput, Settings } from '@/shared/api';
import {
  CategoryListSchema,
  CategorySchema,
  CreateCategoryRequestSchema,
  CreateTaskFromTextRequestSchema,
  CreateTaskStructuredRequestSchema,
  DelayTaskRequestSchema,
  ListTasksQuerySchema,
  ParseTextRequestSchema,
  SettingsSchema,
  SnoozeTaskRequestSchema,
  UpdateCategoryRequestSchema,
  UpdateSettingsRequestSchema,
  UpdateTaskRequestSchema,
} from '@/shared/api';
import { wire } from '@/shared/api/contract.gen';
import { mergeSettings } from '@/features/settings/hooks';
import {
  buildCategories,
  buildFixtures,
  buildSettings,
  makeTask,
  mockUser,
  newId,
  nextFireAt,
  type MockTask,
} from './fixtures';

/**
 * Next occurrence after `from` (device-zone approximation of the backend's
 * common/recurrence.ts; good enough for toasts and the timeline in dev).
 */
function nextOccurrence(recurrence: Recurrence, from: Date): Date {
  const n = Math.max(1, recurrence.interval ?? 1);
  switch (recurrence.type) {
    case 'daily':
      return addDays(from, 1);
    case 'every_n_days':
      return addDays(from, Math.max(1, recurrence.intervalDays ?? 1));
    case 'weekdays': {
      let next = addDays(from, 1);
      while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
      return next;
    }
    case 'weekly': {
      const days = recurrence.byWeekday ?? [];
      if (days.length === 0) return addWeeks(from, n);
      for (let i = 1; i <= 7 * n; i += 1) {
        const next = addDays(from, i);
        if (days.includes(next.getDay())) return next;
      }
      return addWeeks(from, n);
    }
    case 'monthly': {
      const next = addMonths(from, n);
      return recurrence.lastDayOfMonth ? setSeconds(setMinutes(setHours(lastDayOfMonth(next), from.getHours()), from.getMinutes()), 0) : next;
    }
    case 'yearly':
      return addYears(from, n);
  }
}

/**
 * MSW handlers for every endpoint of the contract. Requests are validated
 * with the contract's request schemas and every response is run through the
 * `wire.*` / response schema before it leaves, so the mocks cannot drift from
 * what the real backend is allowed to send.
 */

const API = '*/api/v1';
const LATENCY_MS = 250;

let tasks: MockTask[] = buildFixtures();
let user = { ...mockUser };
let settings: Settings = buildSettings();
let categories: Category[] = buildCategories();

function isOverdue(task: MockTask): boolean {
  const fire = nextFireAt(task);
  return task.status === 'pending' && fire !== null && fire.getTime() < Date.now();
}

function toDto(task: MockTask) {
  const fire = nextFireAt(task);
  return wire.Task.parse({
    id: task.id,
    description: task.description,
    notes: task.notes,
    kind: task.scheduledAt === null ? 'todo' : 'reminder',
    scheduledAt: task.scheduledAt ? task.scheduledAt.toISOString() : null,
    timezone: task.timezone,
    snoozedUntil: task.snoozedUntil ? task.snoozedUntil.toISOString() : null,
    nextFireAt: fire ? fire.toISOString() : null,
    leadMinutes: task.leadMinutes,
    status: task.status,
    priority: task.priority,
    categoryId: task.categoryId,
    recurrence: task.recurrence ? recurrenceToWire(task.recurrence) : null,
    source: task.source,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    completionsCount: task.completionsCount,
    snoozeCount: task.snoozeCount,
    isOverdue: isOverdue(task),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
}

function taskResponse(task: MockTask, status = 200) {
  return HttpResponse.json(toDto(task), { status });
}

function isValidObjectId(id: string | undefined): id is string {
  return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json({ statusCode: status, error: code, message }, { status });
}

function badRequest(message: string) {
  return error(400, 'BAD_REQUEST', message);
}

function paramId(id: string | readonly string[] | undefined): string | undefined {
  return Array.isArray(id) ? id[0] : (id as string | undefined);
}

function find(id: string | readonly string[] | undefined): MockTask | undefined {
  const key = paramId(id);
  return tasks.find((t) => t.id === key && t.status !== 'deleted');
}

function touch(task: MockTask): MockTask {
  task.updatedAt = new Date();
  return task;
}

/** End of "today" on the user's calendar, as an absolute instant. */
function endOfTodayInUserTz(): number {
  return endOfDay(new TZDate(Date.now(), user.timezone ?? 'UTC')).getTime();
}

function startOfTodayInUserTz(): number {
  return startOfDay(new TZDate(Date.now(), user.timezone ?? 'UTC')).getTime();
}

function byFireAt(a: MockTask, b: MockTask): number {
  const at = nextFireAt(a)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = nextFireAt(b)?.getTime() ?? Number.POSITIVE_INFINITY;
  return at - bt;
}

/** Tiny stand-in for the AI parser: "tomorrow" → tomorrow 09:00, else +1h. */
function fakeParse(text: string): {
  description: string;
  scheduledAt: Date;
  recurrence: Recurrence | null;
} {
  const lower = text.toLowerCase();
  const now = new Date();
  // "at 5", "at 5pm", "at 17:30": a bare 1–11 reads as afternoon, like a
  // model would guess; the app flags it as ambiguous.
  const clock = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(lower);
  let hour = 9;
  let minute = 0;
  if (clock) {
    hour = Number(clock[1]) % 24;
    minute = Number(clock[2] ?? 0);
    if (clock[3] === 'pm' && hour < 12) hour += 12;
    else if (clock[3] === 'am' && hour === 12) hour = 0;
    else if (!clock[3] && !clock[2] && hour >= 1 && hour <= 11) hour += 12;
  }
  const at = (d: Date) => setSeconds(setMinutes(setHours(d, hour), minute), 0);
  let scheduledAt = lower.includes('tomorrow')
    ? at(addDays(startOfDay(now), 1))
    : clock
      ? at(startOfDay(now))
      : addMinutes(now, 60);
  if (scheduledAt.getTime() <= now.getTime()) scheduledAt = addDays(scheduledAt, 1);
  let recurrence: Recurrence | null = null;
  if (/every day|daily/.test(lower)) recurrence = { type: 'daily' };
  else if (/weekdays?/.test(lower)) recurrence = { type: 'weekdays' };
  else if (/every week|weekly/.test(lower)) recurrence = { type: 'weekly' };
  else if (/every month|monthly/.test(lower)) recurrence = { type: 'monthly' };
  const description = text
    .replace(/\b(remind me to|tomorrow|today|every (day|week|month)|daily|weekly|monthly|weekdays?)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { description: description || text.trim(), scheduledAt, recurrence };
}

/** Same keyword matching idea as the backend's category suggestion. */
function suggestCategory(text: string): string | null {
  const lower = text.toLowerCase();
  return (
    categories.find((c) => c.keywords.some((k) => lower.includes(k.toLowerCase())))
      ?.id ?? null
  );
}

export const handlers = [
  // ---------------------------------------------------------------- auth ---
  http.post(`${API}/auth/telegram`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = request.headers.get('authorization') ?? '';
    if (!auth.startsWith('tma ')) {
      return error(401, 'UNAUTHORIZED', 'Missing tma initData');
    }
    return HttpResponse.json(
      wire.AuthResult.parse({
        token: 'mock-jwt-token',
        expiresAt: addMinutes(new Date(), 15).toISOString(),
        user,
      }),
    );
  }),

  http.get(`${API}/user/me`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(wire.User.parse(user));
  }),

  http.patch(`${API}/user/timezone`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = (await request.json()) as { timezone?: string };
    if (!body.timezone) return badRequest('timezone is required');
    user = { ...user, timezone: body.timezone };
    return HttpResponse.json(wire.User.parse(user));
  }),

  // ------------------------------------------------------------ settings ---
  http.get(`${API}/settings`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(SettingsSchema.parse(settings));
  }),

  http.patch(`${API}/settings`, async ({ request }) => {
    await delay(LATENCY_MS);
    const parsed = UpdateSettingsRequestSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid settings');
    settings = mergeSettings(settings, parsed.data);
    return HttpResponse.json(SettingsSchema.parse(settings));
  }),

  // ---------------------------------------------------------- categories ---
  http.get(`${API}/categories`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(CategoryListSchema.parse({ categories }));
  }),

  http.post(`${API}/categories`, async ({ request }) => {
    await delay(LATENCY_MS);
    const parsed = CreateCategoryRequestSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid category');
    const category: Category = { id: newId(), ...parsed.data };
    categories = [...categories, category];
    return HttpResponse.json(CategorySchema.parse(category), { status: 201 });
  }),

  http.patch(`${API}/categories/:id`, async ({ params, request }) => {
    await delay(LATENCY_MS);
    const id = paramId(params['id']);
    const existing = categories.find((c) => c.id === id);
    if (!existing) return error(404, 'NOT_FOUND', 'Category not found');
    const parsed = UpdateCategoryRequestSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid category');
    const patch = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    );
    const updated: Category = { ...existing, ...patch };
    categories = categories.map((c) => (c.id === id ? updated : c));
    return HttpResponse.json(CategorySchema.parse(updated));
  }),

  http.delete(`${API}/categories/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const id = paramId(params['id']);
    if (!categories.some((c) => c.id === id)) {
      return error(404, 'NOT_FOUND', 'Category not found');
    }
    categories = categories.filter((c) => c.id !== id);
    for (const task of tasks) if (task.categoryId === id) task.categoryId = null;
    return HttpResponse.json({ success: true });
  }),

  // --------------------------------------------------------------- tasks ---
  http.get(`${API}/tasks`, async ({ request }) => {
    await delay(LATENCY_MS);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = ListTasksQuerySchema.safeParse(params);
    if (!query.success) return badRequest(query.error.issues[0]?.message ?? 'Invalid query');
    const { view = 'all', includeCompleted, limit } = query.data;

    const alive = tasks.filter((t) => t.status !== 'deleted');
    const endToday = endOfTodayInUserTz();
    const startToday = startOfTodayInUserTz();
    let list: MockTask[];
    switch (view) {
      case 'today':
        list = alive
          .filter((t) => {
            const fire = nextFireAt(t);
            if (t.status === 'pending') return fire !== null && fire.getTime() <= endToday;
            return (
              t.status === 'completed' &&
              t.completedAt !== null &&
              t.completedAt.getTime() >= startToday
            );
          })
          .sort(byFireAt);
        break;
      case 'upcoming':
        list = alive
          .filter((t) => {
            const fire = nextFireAt(t);
            return t.status === 'pending' && fire !== null && fire.getTime() > endToday;
          })
          .sort(byFireAt);
        break;
      case 'inbox':
        list = alive
          .filter((t) => t.status === 'pending' && t.scheduledAt === null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'done':
        list = alive
          .filter((t) => t.status === 'completed')
          .sort(
            (a, b) =>
              (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
          )
          .slice(0, limit ?? 50);
        break;
      default:
        list = alive
          .filter((t) => includeCompleted === 'true' || t.status !== 'completed')
          .sort(byFireAt);
    }
    return HttpResponse.json(wire.TaskList.parse({ tasks: list.map(toDto) }));
  }),

  http.get(`${API}/tasks/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const id = paramId(params['id']);
    if (!isValidObjectId(id)) {
      return badRequest('Validation failed (ObjectId is expected)');
    }
    const task = find(id);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    return taskResponse(task);
  }),

  http.post(`${API}/tasks`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = CreateTaskFromTextRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('text is required');
    const parsed = fakeParse(body.data.text);
    const task = makeTask(parsed.description, parsed.scheduledAt, {
      ageDays: 0,
      recurrence: parsed.recurrence,
      categoryId: suggestCategory(parsed.description),
      source: { type: 'miniapp', originalText: body.data.text },
    });
    task.timezone = user.timezone ?? 'UTC';
    tasks = [...tasks, task];
    return taskResponse(task, 201);
  }),

  http.post(`${API}/tasks/structured`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = CreateTaskStructuredRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.issues[0]?.message ?? 'Invalid task');
    const d = body.data;
    const task = makeTask(d.description, d.scheduledAt ? new Date(d.scheduledAt) : null, {
      ageDays: 0,
      notes: d.notes ?? null,
      recurrence: d.recurrence ? recurrenceFromInput(d.recurrence) : null,
      priority: d.priority ?? 'normal',
      categoryId: d.categoryId ?? null,
      leadMinutes: d.leadMinutes ?? null,
      source: { type: 'miniapp', originalText: d.originalText ?? null },
    });
    task.timezone = user.timezone ?? 'UTC';
    tasks = [...tasks, task];
    return taskResponse(task, 201);
  }),

  http.post(`${API}/tasks/voice`, async () => {
    await delay(LATENCY_MS * 4);
    const task = makeTask('Voice memo (mock transcription)', addMinutes(new Date(), 60), {
      ageDays: 0,
      source: { type: 'voice', originalText: 'voice memo, mock transcription' },
    });
    task.timezone = user.timezone ?? 'UTC';
    tasks = [...tasks, task];
    return taskResponse(task, 201);
  }),

  http.patch(`${API}/tasks/:id`, async ({ params, request }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    if (task.status !== 'pending') return badRequest('Only pending tasks can be edited');
    const parsed = UpdateTaskRequestSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid patch');
    const body = parsed.data;
    if (body.description !== undefined) task.description = body.description;
    if (body.notes !== undefined) task.notes = body.notes;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.categoryId !== undefined) task.categoryId = body.categoryId;
    if (body.leadMinutes !== undefined) task.leadMinutes = body.leadMinutes;
    if (body.recurrence !== undefined)
      task.recurrence = body.recurrence ? recurrenceFromInput(body.recurrence) : null;
    if (body.scheduledAt !== undefined) {
      task.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      task.snoozedUntil = null; // an explicit reschedule replaces any snooze
      if (task.scheduledAt === null) {
        // A todo has no series and nothing to be reminded before.
        task.recurrence = null;
        task.leadMinutes = null;
      }
    }
    if (task.recurrence && task.scheduledAt === null) {
      return badRequest('A recurring task needs a scheduledAt');
    }
    return taskResponse(touch(task));
  }),

  http.post(`${API}/tasks/:id/complete`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    if (task.recurrence && task.scheduledAt) {
      // Recurring tasks advance to the next occurrence after now and clear snooze.
      let next = nextOccurrence(task.recurrence, task.scheduledAt);
      while (next.getTime() <= Date.now()) next = nextOccurrence(task.recurrence, next);
      task.scheduledAt = next;
      task.snoozedUntil = null;
      task.completionsCount += 1;
    } else {
      task.status = 'completed';
      task.completedAt = new Date();
    }
    return taskResponse(touch(task));
  }),

  http.post(`${API}/tasks/:id/reopen`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    if (task.status !== 'completed') return badRequest('Only completed tasks can be reopened');
    task.status = 'pending';
    task.completedAt = null;
    return taskResponse(touch(task));
  }),

  http.post(`${API}/tasks/:id/delay`, async ({ params, request }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    const body = DelayTaskRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('minutes must be a positive integer');
    const fire = nextFireAt(task);
    if (task.status !== 'pending' || fire === null) {
      return badRequest('Only pending reminders can be delayed');
    }
    // Same rule as the backend: overdue tasks snooze from now, others from
    // their (current) fire time. A recurring task keeps its series time and
    // gets a one-off snoozedUntil instead.
    const until = addMinutes(new Date(Math.max(fire.getTime(), Date.now())), body.data.minutes);
    if (task.recurrence) task.snoozedUntil = until;
    else task.scheduledAt = until;
    task.snoozeCount += 1;
    return taskResponse(touch(task));
  }),

  http.post(`${API}/tasks/:id/snooze`, async ({ params, request }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    const body = SnoozeTaskRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('until must be an ISO datetime');
    if (task.status !== 'pending' || task.scheduledAt === null) {
      return badRequest('Only pending reminders can be snoozed');
    }
    const until = new Date(body.data.until);
    if (until.getTime() <= Date.now()) return badRequest('until must be in the future');
    if (task.recurrence) task.snoozedUntil = until;
    else {
      task.scheduledAt = until;
      task.snoozedUntil = null;
    }
    task.snoozeCount += 1;
    return taskResponse(touch(task));
  }),

  http.delete(`${API}/tasks/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    task.status = 'deleted';
    touch(task);
    return HttpResponse.json({ success: true });
  }),

  // ------------------------------------------------------------------ ai ---
  http.post(`${API}/ai/parse`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = ParseTextRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('text is required');
    const parsed = fakeParse(body.data.text);
    return HttpResponse.json(
      wire.ParsedTask.parse({
        description: parsed.description,
        scheduledAt: parsed.scheduledAt.toISOString(),
        recurrence: parsed.recurrence,
      }),
    );
  }),
];

/** Mock tasks keep `until` as a Date (like the app); the wire carries ISO strings. */
function recurrenceToWire(recurrence: Recurrence): RecurrenceInput {
  const { until, ...rest } = recurrence;
  return { ...rest, ...(until ? { until: until.toISOString() } : {}) };
}

function recurrenceFromInput(input: RecurrenceInput): Recurrence {
  const { until, ...rest } = input;
  return { ...rest, ...(until ? { until: new Date(until) } : {}) };
}
