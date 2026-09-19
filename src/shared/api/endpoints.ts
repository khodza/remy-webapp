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
  return UserSchema.parse(
    await apiRequest<unknown>('PATCH', '/user/timezone', { body }),
  );
}

// -------------------------------------------------------------- settings ---

export async function getSettings(): Promise<Settings> {
  return SettingsSchema.parse(await apiRequest<unknown>('GET', '/settings'));
}

export async function updateSettings(
  patch: UpdateSettingsRequest,
): Promise<Settings> {
  const body = UpdateSettingsRequestSchema.parse(patch);
  return SettingsSchema.parse(
    await apiRequest<unknown>('PATCH', '/settings', { body }),
  );
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
  return CategorySchema.parse(
    await apiRequest<unknown>('POST', '/categories', { body }),
  );
}

export async function updateCategory(
  id: string,
  patch: UpdateCategoryRequest,
): Promise<Category> {
  const body = UpdateCategoryRequestSchema.parse(patch);
  return CategorySchema.parse(
    await apiRequest<unknown>('PATCH', `/categories/${id}`, { body }),
  );
}

export async function deleteCategory(id: string): Promise<DeleteResult> {
  return DeleteResultSchema.parse(
    await apiRequest<unknown>('DELETE', `/categories/${id}`),
  );
}

// ----------------------------------------------------------------- tasks ---

export interface ListTasksParams {
  view?: TaskView;
  /** Only meaningful for view "all" (or no view). */
  includeCompleted?: boolean;
  /** Caps view "done". */
  limit?: number;
}

export async function listTasks(params: ListTasksParams = {}): Promise<Task[]> {
  const query = ListTasksQuerySchema.parse({
    ...(params.view ? { view: params.view } : {}),
    ...(params.includeCompleted ? { includeCompleted: 'true' } : {}),
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
  });
  const data = await apiRequest<unknown>('GET', '/tasks', { query });
  return TaskListSchema.parse(data).tasks;
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
  originalText?: string;
}

/** Already-reviewed fields; nothing is parsed on the server. */
export async function createTaskStructured(
  input: StructuredTaskInput,
): Promise<Task> {
  const { scheduledAt, recurrence, ...rest } = input;
  const body = CreateTaskStructuredRequestSchema.parse({
    ...rest,
    ...(recurrence !== undefined ? { recurrence: recurrenceBody(recurrence) } : {}),
    ...(scheduledAt !== undefined
      ? { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null }
      : {}),
  });
  return TaskSchema.parse(
    await apiRequest<unknown>('POST', '/tasks/structured', { body }),
  );
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
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  const { scheduledAt, recurrence, ...rest } = patch;
  const body = UpdateTaskRequestSchema.parse({
    ...rest,
    ...(recurrence !== undefined ? { recurrence: recurrenceBody(recurrence) } : {}),
    ...(scheduledAt !== undefined
      ? { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null }
      : {}),
  });
  return TaskSchema.parse(
    await apiRequest<unknown>('PATCH', `/tasks/${id}`, { body }),
  );
}

export async function completeTask(id: string): Promise<Task> {
  return TaskSchema.parse(
    await apiRequest<unknown>('POST', `/tasks/${id}/complete`),
  );
}

export async function reopenTask(id: string): Promise<Task> {
  return TaskSchema.parse(
    await apiRequest<unknown>('POST', `/tasks/${id}/reopen`),
  );
}

export async function delayTask(id: string, minutes: number): Promise<Task> {
  const body = DelayTaskRequestSchema.parse({ minutes });
  return TaskSchema.parse(
    await apiRequest<unknown>('POST', `/tasks/${id}/delay`, { body }),
  );
}

/** Absolute snooze ("Tonight 20:00"); `until` must be in the future. */
export async function snoozeTask(id: string, until: Date): Promise<Task> {
  const body = SnoozeTaskRequestSchema.parse({ until: until.toISOString() });
  return TaskSchema.parse(
    await apiRequest<unknown>('POST', `/tasks/${id}/snooze`, { body }),
  );
}

export async function deleteTask(id: string): Promise<DeleteResult> {
  return DeleteResultSchema.parse(
    await apiRequest<unknown>('DELETE', `/tasks/${id}`),
  );
}

// -------------------------------------------------------------------- ai ---

export async function parseText(text: string): Promise<ParsedTask> {
  const body = ParseTextRequestSchema.parse({ text });
  return ParsedTaskSchema.parse(
    await apiRequest<unknown>('POST', '/ai/parse', { body }),
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
