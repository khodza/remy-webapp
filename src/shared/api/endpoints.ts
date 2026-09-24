import { apiRequest } from './client';
import {
  CategoryListSchema,
  CategorySchema,
  CreateCategoryRequestSchema,
  CreateTaskFromTextRequestSchema,
  CreateTaskStructuredRequestSchema,
  DelayTaskRequestSchema,
  DeleteResultSchema,
  ListTasksQuerySchema,
  ParseTextRequestSchema,
  ParsedTaskSchema,
  SettingsSchema,
  SnoozeTaskRequestSchema,
  TaskListSchema,
  TaskSchema,
  UpdateCategoryRequestSchema,
  UpdateSettingsRequestSchema,
  UpdateTaskRequestSchema,
  UpdateTimezoneRequestSchema,
  UserSchema,
  CalendarFeedSchema,
  ExportRequestSchema,
  ExportResultSchema,
  ImportDraftsSchema,
  ImportTasksRequestSchema,
  ParseListRequestSchema,
  CompleteResultSchema,
  OkResultSchema,
  ListSummariesSchema,
  DeleteAllDataRequestSchema,
  DeleteAllDataResultSchema,
  ClientErrorReportSchema,
  GoogleConnectResultSchema,
  GoogleStatusSchema,
  SelectGoogleCalendarsRequestSchema,
  type GoogleConnectResult,
  type GoogleStatus,
  type ClientErrorReport,
  type CompleteResult,
  type DeleteAllDataResult,
  type ListSummary,
  type OkResult,
  type CalendarFeed,
  type ExportFormat,
  type ExportResult,
  type ImportDraft,
  type Category,
  type CreateCategoryRequest,
  type DeleteResult,
  type ParsedTask,
  type Priority,
  type Recurrence,
  type Settings,
  type Task,
  type TaskView,
  type UpdateCategoryRequest,
  type UpdateSettingsRequest,
  type User,
} from './schemas';

/**
 * Every request body is parsed with the contract's request schema before it
 * is sent (a malformed body fails here, in the UI's stack, not as a 400),
 * and every response with the matching response schema.
 */

// ------------------------------------------------------------------ user ---

export async function getMe(): Promise<User> {
  return UserSchema.parse(await apiRequest<unknown>('GET', '/user/me'));
}

export async function updateTimezone(timezone: string): Promise<User> {
  const body = UpdateTimezoneRequestSchema.parse({ timezone });
  return UserSchema.parse(await apiRequest<unknown>('PATCH', '/user/timezone', { body }));
}

// -------------------------------------------------------------- settings ---

export async function getSettings(): Promise<Settings> {
  return SettingsSchema.parse(await apiRequest<unknown>('GET', '/settings'));
}

export async function updateSettings(patch: UpdateSettingsRequest): Promise<Settings> {
  const body = UpdateSettingsRequestSchema.parse(patch);
  return SettingsSchema.parse(await apiRequest<unknown>('PATCH', '/settings', { body }));
}

// ------------------------------------------------------------ categories ---

export async function listCategories(): Promise<Category[]> {
  const data = await apiRequest<unknown>('GET', '/categories');
  return CategoryListSchema.parse(data).categories;
}

export async function createCategory(
  input: CreateCategoryRequest | Omit<CreateCategoryRequest, 'keywords'>,
): Promise<Category> {
  const body = CreateCategoryRequestSchema.parse(input);
  return CategorySchema.parse(await apiRequest<unknown>('POST', '/categories', { body }));
}

export async function updateCategory(id: string, patch: UpdateCategoryRequest): Promise<Category> {
  const body = UpdateCategoryRequestSchema.parse(patch);
  return CategorySchema.parse(await apiRequest<unknown>('PATCH', `/categories/${id}`, { body }));
}

export async function deleteCategory(id: string): Promise<DeleteResult> {
  return DeleteResultSchema.parse(await apiRequest<unknown>('DELETE', `/categories/${id}`));
}

// ----------------------------------------------------------------- tasks ---

export interface ListTasksParams {
  view?: TaskView;
  /** Only meaningful for view "all" (or no view). */
  includeCompleted?: boolean;
  /** Caps view "done" and a search. */
  limit?: number;
  /** Only tasks on this named list. */
  list?: string;
  /**
   * Server search (every word in title, notes or list; pending and
   * completed). `view` and `includeCompleted` are ignored with it.
   */
  q?: string;
}

/** `signal` cancels a search the user has already typed past. */
export async function listTasks(params: ListTasksParams = {}, options: { signal?: AbortSignal } = {}): Promise<Task[]> {
  const query = ListTasksQuerySchema.parse({
    ...(params.view ? { view: params.view } : {}),
    ...(params.includeCompleted ? { includeCompleted: 'true' } : {}),
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
    ...(params.list ? { list: params.list } : {}),
    ...(params.q ? { q: params.q } : {}),
  });
  const data = await apiRequest<unknown>('GET', '/tasks', {
    query,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return TaskListSchema.parse(data).tasks;
}

/** GET /lists: every named list with its pending and completed counts. */
export async function listLists(): Promise<ListSummary[]> {
  return ListSummariesSchema.parse(await apiRequest<unknown>('GET', '/lists')).lists;
}

export async function getTask(id: string): Promise<Task> {
  return TaskSchema.parse(await apiRequest<unknown>('GET', `/tasks/${id}`));
}

/** Natural language; the server parses it. */
export async function createTask(text: string): Promise<Task> {
  const body = CreateTaskFromTextRequestSchema.parse({ text });
  return TaskSchema.parse(await apiRequest<unknown>('POST', '/tasks', { body }));
}

/** Requests carry `until` as an ISO string; the app works with a Date. */
function recurrenceBody(recurrence: Recurrence | null) {
  if (!recurrence) return null;
  const { until, ...rest } = recurrence;
  return { ...rest, ...(until ? { until: until.toISOString() } : {}) };
}

export interface StructuredTaskInput {
  description: string;
  notes?: string | null;
  /** Omit or null for a todo (Inbox). */
  scheduledAt?: Date | null;
  recurrence?: Recurrence | null;
  priority?: Priority;
  categoryId?: string | null;
  leadMinutes?: number | null;
  /** A date with no time (needs scheduledAt; the server stores 09:00 on it). */
  allDay?: boolean;
  /** Named list; the server normalises it ("My Shopping List" → "shopping"). */
  list?: string | null;
  originalText?: string;
}

/** Already-reviewed fields; nothing is parsed on the server. */
export async function createTaskStructured(input: StructuredTaskInput): Promise<Task> {
  const { scheduledAt, recurrence, ...rest } = input;
  const body = CreateTaskStructuredRequestSchema.parse({
    ...rest,
    ...(recurrence !== undefined ? { recurrence: recurrenceBody(recurrence) } : {}),
    ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null } : {}),
  });
  return TaskSchema.parse(await apiRequest<unknown>('POST', '/tasks/structured', { body }));
}

/** undefined leaves a field alone, null clears it. */
export interface TaskPatch {
  description?: string;
  notes?: string | null;
  /** null turns a reminder into a todo. */
  scheduledAt?: Date | null;
  recurrence?: Recurrence | null;
  priority?: Priority;
  categoryId?: string | null;
  leadMinutes?: number | null;
  /** true keeps only the date (09:00 local); false makes it a timed reminder again. */
  allDay?: boolean;
  /** null takes the task off its list. */
  list?: string | null;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  const { scheduledAt, recurrence, ...rest } = patch;
  const body = UpdateTaskRequestSchema.parse({
    ...rest,
    ...(recurrence !== undefined ? { recurrence: recurrenceBody(recurrence) } : {}),
    ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null } : {}),
  });
  return TaskSchema.parse(await apiRequest<unknown>('PATCH', `/tasks/${id}`, { body }));
}

/** Done. `alreadyDone` means nothing changed (a second tap). */
export async function completeTask(id: string): Promise<CompleteResult> {
  return CompleteResultSchema.parse(await apiRequest<unknown>('POST', `/tasks/${id}/complete`));
}

/** Repeating tasks only: on to the next occurrence without a Done. */
export async function skipOccurrence(id: string): Promise<Task> {
  return TaskSchema.parse(await apiRequest<unknown>('POST', `/tasks/${id}/skip`));
}

export async function reopenTask(id: string): Promise<Task> {
  return TaskSchema.parse(await apiRequest<unknown>('POST', `/tasks/${id}/reopen`));
}

export async function delayTask(id: string, minutes: number): Promise<Task> {
  const body = DelayTaskRequestSchema.parse({ minutes });
  return TaskSchema.parse(await apiRequest<unknown>('POST', `/tasks/${id}/delay`, { body }));
}

/** Absolute snooze ("Tonight 20:00"); `until` must be in the future. */
export async function snoozeTask(id: string, until: Date): Promise<Task> {
  const body = SnoozeTaskRequestSchema.parse({ until: until.toISOString() });
  return TaskSchema.parse(await apiRequest<unknown>('POST', `/tasks/${id}/snooze`, { body }));
}

export async function deleteTask(id: string): Promise<DeleteResult> {
  return DeleteResultSchema.parse(await apiRequest<unknown>('DELETE', `/tasks/${id}`));
}

/**
 * The bot replies in the chat to the message the task came from. 404 when
 * there is no source message, 409 when it was deleted from the chat, 502
 * when Telegram refused.
 */
export async function showTaskSource(id: string): Promise<OkResult> {
  return OkResultSchema.parse(await apiRequest<unknown>('POST', `/tasks/${id}/show-source`));
}

// -------------------------------------------------------------------- ai ---

/**
 * `signal` cancels a parse the user has already typed past (F13). A text that
 * holds no new task (chat, a time that already passed) is a 422 whose
 * message says why.
 */
export async function parseText(text: string, options: { signal?: AbortSignal } = {}): Promise<ParsedTask> {
  const body = ParseTextRequestSchema.parse({ text });
  return ParsedTaskSchema.parse(
    await apiRequest<unknown>('POST', '/ai/parse', {
      body,
      ...(options.signal ? { signal: options.signal } : {}),
    }),
  );
}

// ------------------------------------------------------------------ data ---

/** The private calendar subscription: state, turn on / new link, turn off. */
export async function getCalendarFeed(): Promise<CalendarFeed> {
  return CalendarFeedSchema.parse(await apiRequest<unknown>('GET', '/calendar/feed'));
}

export async function enableCalendarFeed(): Promise<CalendarFeed> {
  return CalendarFeedSchema.parse(await apiRequest<unknown>('POST', '/calendar/feed'));
}

export async function disableCalendarFeed(): Promise<CalendarFeed> {
  return CalendarFeedSchema.parse(await apiRequest<unknown>('DELETE', '/calendar/feed'));
}

/** The bot sends the file to the chat; this says what it sent. */
export async function exportData(format: ExportFormat): Promise<ExportResult> {
  const body = ExportRequestSchema.parse({ format });
  return ExportResultSchema.parse(await apiRequest<unknown>('POST', '/export', { body }));
}

/** "Delete all my data": every task, the categories, memory, the feed link; settings back to defaults. */
export async function deleteAllData(): Promise<DeleteAllDataResult> {
  const body = DeleteAllDataRequestSchema.parse({ confirm: 'DELETE' });
  return DeleteAllDataResultSchema.parse(await apiRequest<unknown>('DELETE', '/data', { body }));
}

/** A Mini App error for the server log (204). Never carries initData or a token. */
export async function reportClientError(report: ClientErrorReport): Promise<void> {
  const body = ClientErrorReportSchema.parse(report);
  await apiRequest<void>('POST', '/client-errors', { body, silent: true });
}

/** A pasted list → drafts to review. Nothing is saved. */
export async function parseList(text: string): Promise<ImportDraft[]> {
  const body = ParseListRequestSchema.parse({ text });
  return ImportDraftsSchema.parse(await apiRequest<unknown>('POST', '/ai/parse-list', { body })).tasks;
}

/** The reviewed drafts, created in one request (all or nothing). */
export async function importTasks(tasks: StructuredTaskInput[]): Promise<Task[]> {
  const body = ImportTasksRequestSchema.parse({
    tasks: tasks.map(({ scheduledAt, recurrence, ...rest }) => ({
      ...rest,
      ...(recurrence !== undefined ? { recurrence: recurrenceBody(recurrence) } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null } : {}),
    })),
  });
  return TaskListSchema.parse(await apiRequest<unknown>('POST', '/tasks/import', { body })).tasks;
}

// ---------------------------------------------------------- integrations ---

/** Google Calendar: not configured on the server, configured, or connected (with the calendars). */
export async function getGoogleStatus(): Promise<GoogleStatus> {
  return GoogleStatusSchema.parse(await apiRequest<unknown>('GET', '/integrations/google/status'));
}

/** The consent URL to open in the system browser; 409 when the server has no Google client. */
export async function connectGoogle(): Promise<GoogleConnectResult> {
  return GoogleConnectResultSchema.parse(await apiRequest<unknown>('POST', '/integrations/google/connect'));
}

/** Revokes the grant at Google and forgets the account. */
export async function disconnectGoogle(): Promise<void> {
  await apiRequest<unknown>('DELETE', '/integrations/google');
}

/**
 * Which calendars feed the brief (empty = the primary one). The server
 * answers with the fresh status when it can; a caller refetches otherwise.
 */
export async function selectGoogleCalendars(calendarIds: string[]): Promise<GoogleStatus | null> {
  const body = SelectGoogleCalendarsRequestSchema.parse({ calendarIds });
  const result = GoogleStatusSchema.safeParse(await apiRequest<unknown>('PATCH', '/integrations/google', { body }));
  return result.success ? result.data : null;
}
