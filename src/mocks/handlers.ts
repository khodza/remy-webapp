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
  ClientErrorReportSchema,
  CreateCategoryRequestSchema,
  CreateTaskFromTextRequestSchema,
  CreateTaskStructuredRequestSchema,
  DelayTaskRequestSchema,
  DeleteAllDataRequestSchema,
  DeleteAllDataResultSchema,
  ExportRequestSchema,
  ImportTasksRequestSchema,
  ListSummariesSchema,
  ListTasksQuerySchema,
  ParseListRequestSchema,
  ParseTextRequestSchema,
  SettingsSchema,
  SnoozeTaskRequestSchema,
  UpdateCategoryRequestSchema,
  UpdateSettingsRequestSchema,
  UpdateTaskRequestSchema,
} from '@/shared/api';
import { wire, type TaskDraftWire } from '@/shared/api/contract.gen';
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
      return recurrence.lastDayOfMonth
        ? setSeconds(setMinutes(setHours(lastDayOfMonth(next), from.getHours()), from.getMinutes()), 0)
        : next;
    }
    case 'yearly':
      return addYears(from, n);
  }
}

/**
 * The series time after this occurrence, or null when the series is over
 * (its count is used up or `until` has passed).
 */
function advance(task: MockTask): Date | null {
  if (!task.recurrence || !task.scheduledAt) return null;
  const { recurrence } = task;
  // Done and skipped both count; completions is the only tally the mock keeps.
  if (recurrence.count !== undefined && task.completions.length >= recurrence.count) return null;
  let next = nextOccurrence(recurrence, task.scheduledAt);
  while (next.getTime() <= Date.now()) next = nextOccurrence(recurrence, next);
  if (recurrence.until && next.getTime() > recurrence.until.getTime()) return null;
  return next;
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
/** Calendar feed secret; null = off. */
let calendarToken: string | null = null;
/** Bumped by /auth/refresh so a refreshed token is visibly a new one. */
let tokenSeq = 0;

function authResult() {
  tokenSeq += 1;
  return wire.AuthResult.parse({
    token: `mock-jwt-token-${tokenSeq}`,
    expiresAt: addMinutes(new Date(), 15).toISOString(),
    user,
  });
}

/** Same rule as the backend's common/list-name.ts. */
function normaliseListName(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let name = raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  name = name.replace(/^(the|my)\s+/u, '');
  name = name.replace(/\s+list$/u, '');
  name = name.slice(0, 40).trim();
  return name === '' ? null : name;
}

/** An all-day task pings at 09:00 on its date, in the user's zone. */
function allDayInstant(date: Date): Date {
  const zone = user.timezone ?? 'UTC';
  const local = new TZDate(date.getTime(), zone);
  return new Date(new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 9, 0, zone).getTime());
}

function feedDto() {
  return { enabled: calendarToken !== null, path: calendarToken ? `/calendar/${calendarToken}.ics` : null };
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function isOverdue(task: MockTask): boolean {
  const fire = nextFireAt(task);
  if (task.status !== 'pending' || fire === null) return false;
  // An all-day task is late only once its day is over.
  if (task.allDay && !task.snoozedUntil)
    return endOfDay(new TZDate(fire.getTime(), user.timezone ?? 'UTC')).getTime() < Date.now();
  return fire.getTime() < Date.now();
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
    allDay: task.scheduledAt !== null && task.allDay,
    list: task.list,
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
    completions: [...task.completions]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 50)
      .map((c) => ({ at: c.at.toISOString(), occurrenceAt: c.occurrenceAt.toISOString() })),
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

/** Small talk and the like: the real assistant answers 422 "not a task". */
const NOT_A_TASK = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|lol|test)\b[!. ]*$/i;

/** Words that mean the line names a time (else it is an Inbox todo). */
const TIME_CUE =
  /\b(today|tomorrow|tonight|at \d|in \d+ ?(min|minutes|hours?|h)|every|daily|weekly|monthly|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|weekend)\b/i;

interface FakeDraft {
  description: string;
  scheduledAt: Date | null;
  allDay: boolean;
  recurrence: Recurrence | null;
  leadMinutes: number | null;
  priority: 'low' | 'normal' | 'high';
  list: string | null;
}

/**
 * Tiny stand-in for the assistant's parse: "tomorrow" → tomorrow 09:00,
 * "at 5" → 17:00 (the app flags it as ambiguous), no time cue → an Inbox
 * todo, "tomorrow" alone → an all-day task, "every ... 5 times" → count,
 * "30 min before" → lead time, "!" → high priority, "to the X list" → list.
 */
function fakeParse(text: string): FakeDraft {
  const lower = text.toLowerCase();
  const now = new Date();
  const clock = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(lower);
  const relative = /\bin\s+(\d+)\s*(min|minutes?|hours?|h)\b/.exec(lower);
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
  const timed = TIME_CUE.test(lower);
  const allDay =
    timed &&
    !clock &&
    !relative &&
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower) &&
    !/\bevery\b/.test(lower);
  let scheduledAt: Date | null = null;
  if (relative) {
    const n = Number(relative[1]);
    scheduledAt = addMinutes(now, /^h/.test(relative[2] ?? '') ? n * 60 : n);
  } else if (timed) {
    scheduledAt = lower.includes('tomorrow')
      ? at(addDays(startOfDay(now), 1))
      : clock || lower.includes('today') || lower.includes('tonight')
        ? at(startOfDay(now))
        : addMinutes(now, 60);
    if (allDay) scheduledAt = allDayInstant(scheduledAt);
    else if (scheduledAt.getTime() <= now.getTime()) scheduledAt = addDays(scheduledAt, 1);
  }
  let recurrence: Recurrence | null = null;
  if (/every day|daily/.test(lower)) recurrence = { type: 'daily' };
  else if (/weekdays?/.test(lower)) recurrence = { type: 'weekdays' };
  else if (/every week|weekly/.test(lower)) recurrence = { type: 'weekly' };
  else if (/every month|monthly/.test(lower)) recurrence = { type: 'monthly' };
  const times = /\b(\d{1,4})\s*times\b/.exec(lower);
  if (recurrence && times) recurrence = { ...recurrence, count: Number(times[1]) };
  const lead = /\b(\d{1,3})\s*(min|minutes?|hours?|h)\s+before\b/.exec(lower);
  const leadMinutes = lead ? Number(lead[1]) * (/^h/.test(lead[2] ?? '') ? 60 : 1) : null;
  const listMatch = /\b(?:to|on)\s+(?:the\s+|my\s+)?([\p{L}\d ]{2,30}?)\s+list\b/u.exec(lower);
  const list = normaliseListName(listMatch?.[1] ?? null);
  const description = text
    .replace(
      /\b(remind me to|add|tomorrow|today|tonight|every (day|week|month)|daily|weekly|monthly|weekdays?)\b/gi,
      '',
    )
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\bin\s+\d+\s*(min|minutes?|hours?|h)\b/gi, '')
    .replace(/\b\d{1,4}\s*times\b/gi, '')
    .replace(/\b\d{1,3}\s*(min|minutes?|hours?|h)\s+before\b/gi, '')
    .replace(/\b(?:to|on)\s+(?:the\s+|my\s+)?[\p{L}\d ]{2,30}?\s+list\b/giu, '')
    .replace(/\s*#[\p{L}\d_-]+/gu, '')
    .replace(/\s*!+/g, '')
    .replace(/[,;]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const title = description || text.trim();
  return {
    description: title.charAt(0).toUpperCase() + title.slice(1),
    scheduledAt,
    allDay,
    recurrence,
    leadMinutes,
    priority: /!|urgent|important/i.test(text) ? 'high' : /\bsomeday\b/i.test(text) ? 'low' : 'normal',
    list,
  };
}

function draftWire(text: string): TaskDraftWire {
  const d = fakeParse(text);
  return {
    description: d.description,
    notes: null,
    scheduledAt: d.scheduledAt ? d.scheduledAt.toISOString() : null,
    allDay: d.allDay,
    recurrence: d.scheduledAt && d.recurrence ? recurrenceToWire(d.recurrence) : null,
    priority: d.priority,
    categoryId: suggestCategory(text),
    leadMinutes: d.scheduledAt ? d.leadMinutes : null,
    list: d.list,
  };
}

/** One draft per line, or per ", and" / " and then " clause on one line. */
function splitTasks(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d{1,3}[.)]|\[[ xX]?\])\s*/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return (lines[0] ?? '')
    .split(/\s*(?:;|,\s*and\s+|\s+and\s+then\s+)\s*/i)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** A structured draft → a stored task (structured create and import share it). */
function storeDraft(d: {
  description: string;
  notes?: string | null | undefined;
  scheduledAt?: string | null | undefined;
  allDay?: boolean | undefined;
  recurrence?: RecurrenceInput | null | undefined;
  priority?: 'low' | 'normal' | 'high' | undefined;
  categoryId?: string | null | undefined;
  leadMinutes?: number | null | undefined;
  list?: string | null | undefined;
  originalText?: string | undefined;
}): MockTask {
  const when = d.scheduledAt ? new Date(d.scheduledAt) : null;
  const task = makeTask(d.description, when && d.allDay ? allDayInstant(when) : when, {
    ageDays: 0,
    notes: d.notes ?? null,
    allDay: Boolean(when && d.allDay),
    list: normaliseListName(d.list),
    recurrence: d.recurrence ? recurrenceFromInput(d.recurrence) : null,
    priority: d.priority ?? 'normal',
    categoryId: d.categoryId ?? null,
    leadMinutes: d.leadMinutes ?? null,
    source: { type: 'miniapp', originalText: d.originalText ?? null },
  });
  task.timezone = user.timezone ?? 'UTC';
  return task;
}

/** Same keyword matching idea as the backend's category suggestion. */
function suggestCategory(text: string): string | null {
  const lower = text.toLowerCase();
  return categories.find((c) => c.keywords.some((k) => lower.includes(k.toLowerCase())))?.id ?? null;
}

export const handlers = [
  // ---------------------------------------------------------------- auth ---
  http.post(`${API}/auth/telegram`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = request.headers.get('authorization') ?? '';
    if (!auth.startsWith('tma ')) {
      return error(401, 'UNAUTHORIZED', 'Missing tma initData');
    }
    return HttpResponse.json(authResult());
  }),

  http.post(`${API}/auth/refresh`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = request.headers.get('authorization') ?? '';
    if (!auth.startsWith('Bearer mock-jwt-token')) return error(401, 'UNAUTHORIZED', 'Invalid token');
    return HttpResponse.json(authResult());
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
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
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
    const { view = 'all', includeCompleted, limit, list: listName, q } = query.data;

    let alive = tasks.filter((t) => t.status !== 'deleted');
    const onList = normaliseListName(listName);
    if (onList) alive = alive.filter((t) => t.list === onList);
    if (q) {
      // Every word somewhere in the title, notes or list; pending first
      // (by fire time), then completed newest first. view is ignored.
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hit = (t: MockTask) => {
        const text = [t.description, t.notes, t.list].filter(Boolean).join(' ').toLowerCase();
        return words.every((w) => text.includes(w));
      };
      const found = [
        ...alive.filter((t) => t.status === 'pending' && hit(t)).sort(byFireAt),
        ...alive
          .filter((t) => t.status === 'completed' && hit(t))
          .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
      ].slice(0, limit ?? 50);
      return HttpResponse.json(wire.TaskList.parse({ tasks: found.map(toDto) }));
    }
    const endToday = endOfTodayInUserTz();
    const startToday = startOfTodayInUserTz();
    let list: MockTask[];
    switch (view) {
      case 'today':
        list = alive
          .filter((t) => {
            const fire = nextFireAt(t);
            if (t.status === 'pending') return fire !== null && fire.getTime() <= endToday;
            return t.status === 'completed' && t.completedAt !== null && t.completedAt.getTime() >= startToday;
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
          .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
          .slice(0, limit ?? 50);
        break;
      default:
        list = alive.filter((t) => includeCompleted === 'true' || t.status !== 'completed').sort(byFireAt);
    }
    return HttpResponse.json(wire.TaskList.parse({ tasks: list.map(toDto) }));
  }),

  http.get(`${API}/lists`, async () => {
    await delay(LATENCY_MS);
    const byName = new Map<string, { name: string; pending: number; completed: number }>();
    for (const t of tasks) {
      if (t.status === 'deleted' || !t.list) continue;
      const row = byName.get(t.list) ?? { name: t.list, pending: 0, completed: 0 };
      if (t.status === 'pending') row.pending += 1;
      else row.completed += 1;
      byName.set(t.list, row);
    }
    const lists = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    return HttpResponse.json(ListSummariesSchema.parse({ lists }));
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
    if (NOT_A_TASK.test(body.data.text.trim())) {
      return error(422, 'UNPROCESSABLE_ENTITY', "That doesn't look like a reminder.");
    }
    // Like the assistant: every task the text held is saved, the first is answered.
    const created = splitTasks(body.data.text).map((line) =>
      storeDraft({ ...draftWire(line), originalText: body.data.text }),
    );
    tasks = [...tasks, ...created];
    const first = created[0];
    if (!first) return error(422, 'UNPROCESSABLE_ENTITY', "That doesn't look like a reminder.");
    return taskResponse(first, 201);
  }),

  http.post(`${API}/tasks/structured`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = CreateTaskStructuredRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.issues[0]?.message ?? 'Invalid task');
    const task = storeDraft(body.data);
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
    if (body.list !== undefined) task.list = normaliseListName(body.list);
    if (body.recurrence !== undefined) task.recurrence = body.recurrence ? recurrenceFromInput(body.recurrence) : null;
    if (body.scheduledAt !== undefined) {
      task.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      task.snoozedUntil = null; // an explicit reschedule replaces any snooze
      if (task.scheduledAt === null) {
        // A todo has no series and nothing to be reminded before.
        task.recurrence = null;
        task.leadMinutes = null;
        task.allDay = false;
      }
    }
    if (body.allDay !== undefined) task.allDay = body.allDay && task.scheduledAt !== null;
    // All-day: the date is kept, the time becomes 09:00 local.
    if (task.allDay && task.scheduledAt && (body.allDay !== undefined || body.scheduledAt !== undefined)) {
      task.scheduledAt = allDayInstant(task.scheduledAt);
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
    const completeResult = (t: MockTask, alreadyDone: boolean) =>
      HttpResponse.json(wire.CompleteResult.parse({ ...toDto(t), alreadyDone }));
    if (task.recurrence && task.scheduledAt) {
      // Idempotent like the backend: a series already in the future is not
      // advanced again (a second tap must not skip a cycle).
      if (task.scheduledAt.getTime() > Date.now() && task.status === 'pending') return completeResult(task, true);
      const occurrenceAt = task.scheduledAt;
      const now = new Date();
      task.completions = [{ at: now, occurrenceAt }, ...task.completions];
      task.completionsCount += 1;
      const next = advance(task);
      if (next === null) {
        task.status = 'completed';
        task.completedAt = now;
      } else {
        task.scheduledAt = next;
      }
      task.snoozedUntil = null;
      return completeResult(touch(task), false);
    }
    if (task.status === 'completed') return completeResult(task, true);
    task.status = 'completed';
    task.completedAt = new Date();
    return completeResult(touch(task), false);
  }),

  http.post(`${API}/tasks/:id/skip`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    if (task.status !== 'pending') return badRequest('Only pending tasks can be skipped');
    if (!task.recurrence || !task.scheduledAt) return badRequest('Only repeating tasks can skip an occurrence');
    const next = advance(task);
    if (next === null) {
      task.status = 'completed';
      task.completedAt = new Date();
    } else {
      task.scheduledAt = next;
    }
    task.snoozedUntil = null;
    return taskResponse(touch(task));
  }),

  http.post(`${API}/tasks/:id/show-source`, async ({ params }) => {
    await delay(LATENCY_MS);
    const task = find(params['id']);
    if (!task) return error(404, 'NOT_FOUND', 'Task not found');
    if (task.source.messageId === null) return error(404, 'NOT_FOUND', 'This task has no source message');
    // One fixture stands in for a message deleted from the chat.
    if (task.source.messageId === 3811) return error(409, 'CONFLICT', 'The source message was deleted');
    return HttpResponse.json({ success: true });
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
    if (NOT_A_TASK.test(body.data.text.trim())) {
      return error(422, 'UNPROCESSABLE_ENTITY', "That doesn't look like a reminder.");
    }
    const drafts = splitTasks(body.data.text).map(draftWire);
    const first = drafts[0];
    if (!first) return error(422, 'UNPROCESSABLE_ENTITY', "That doesn't look like a reminder.");
    return HttpResponse.json(wire.ParsedTask.parse({ ...first, drafts }));
  }),

  // ---------------------------------------------------------------- data ---
  http.get(`${API}/calendar/feed`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(feedDto());
  }),

  http.post(`${API}/calendar/feed`, async () => {
    await delay(LATENCY_MS);
    calendarToken = randomToken();
    return HttpResponse.json(feedDto(), { status: 201 });
  }),

  http.delete(`${API}/calendar/feed`, async () => {
    await delay(LATENCY_MS);
    calendarToken = null;
    return HttpResponse.json(feedDto());
  }),

  http.get(`${API}/calendar/:file`, ({ params }) => {
    if (!calendarToken || paramId(params['file']) !== `${calendarToken}.ics`) {
      return error(404, 'NOT_FOUND', 'Calendar not found');
    }
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Remy//Mock//EN',
      'X-WR-CALNAME:Remy (mock)',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
    return new HttpResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
  }),

  http.post(`${API}/export`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = ExportRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('format must be csv, json or ics');
    const date = new Date().toISOString().slice(0, 10);
    const alive = tasks.filter((t) => t.status !== 'deleted');
    return HttpResponse.json({
      filename: `remy-${date}.${body.data.format}`,
      tasks:
        body.data.format === 'ics'
          ? alive.filter((t) => t.status === 'pending' && t.scheduledAt !== null).length
          : alive.length,
    });
  }),

  http.delete(`${API}/data`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = DeleteAllDataRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('confirm must be "DELETE"');
    const deletedTasks = tasks.length;
    tasks = [];
    categories = [];
    settings = buildSettings();
    calendarToken = null;
    return HttpResponse.json(DeleteAllDataResultSchema.parse({ success: true, deletedTasks }));
  }),

  http.post(`${API}/client-errors`, async ({ request }) => {
    const body = ClientErrorReportSchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.issues[0]?.message ?? 'Invalid report');
    console.info('[remy-webapp] client error report (mock):', body.data);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/ai/parse-list`, async ({ request }) => {
    await delay(LATENCY_MS * 3);
    const body = ParseListRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest('text is required');
    // Like the real assistant: each line on its own; a line with a time gets one, others are todos.
    const drafts = splitTasks(body.data.text).slice(0, 50).map(draftWire);
    return HttpResponse.json(wire.ImportDrafts.parse({ tasks: drafts }));
  }),

  http.post(`${API}/tasks/import`, async ({ request }) => {
    await delay(LATENCY_MS * 2);
    const body = ImportTasksRequestSchema.safeParse(await request.json());
    if (!body.success) return badRequest(body.error.issues[0]?.message ?? 'Invalid import');
    const created = body.data.tasks.map(storeDraft);
    tasks = [...tasks, ...created];
    return HttpResponse.json({ tasks: created.map(toDto) }, { status: 201 });
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
