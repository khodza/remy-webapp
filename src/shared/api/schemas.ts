/**
 * Thin naming layer over the generated HTTP contract. Nothing is defined
 * here: every shape comes from `contract.gen.ts`, which is a verbatim copy
 * of the backend's `src/contract/remy-contract.ts` (see ./CLAUDE.md).
 * Responses are parsed with `client.*` (ISO strings coerced to Date).
 */
import { client, type ImportDraft } from './contract.gen';

export const TaskSchema = client.Task;
export const TaskListSchema = client.TaskList;
export const UserSchema = client.User;
export const AuthResultSchema = client.AuthResult;
export const ParsedTaskSchema = client.ParsedTask;
export const ImportDraftsSchema = client.ImportDrafts;
export const CompleteResultSchema = client.CompleteResult;

export {
  CONTRACT_VERSION,
  DEFAULT_SETTINGS,
  Category as CategorySchema,
  CategoryList as CategoryListSchema,
  CreateCategoryRequest as CreateCategoryRequestSchema,
  CreateTaskFromTextRequest as CreateTaskFromTextRequestSchema,
  CreateTaskStructuredRequest as CreateTaskStructuredRequestSchema,
  DelayTaskRequest as DelayTaskRequestSchema,
  DeleteResult as DeleteResultSchema,
  ListTasksQuery as ListTasksQuerySchema,
  ParseTextRequest as ParseTextRequestSchema,
  Priority as PrioritySchema,
  Recurrence as RecurrenceSchema,
  RecurrenceType as RecurrenceTypeSchema,
  Settings as SettingsSchema,
  SnoozeTaskRequest as SnoozeTaskRequestSchema,
  TaskStatus as TaskStatusSchema,
  UpdateCategoryRequest as UpdateCategoryRequestSchema,
  UpdateSettingsRequest as UpdateSettingsRequestSchema,
  UpdateTaskRequest as UpdateTaskRequestSchema,
  UpdateTimezoneRequest as UpdateTimezoneRequestSchema,
  CalendarFeed as CalendarFeedSchema,
  ExportRequest as ExportRequestSchema,
  ExportResult as ExportResultSchema,
  ImportTasksRequest as ImportTasksRequestSchema,
  ParseListRequest as ParseListRequestSchema,
  OkResult as OkResultSchema,
  ListSummaries as ListSummariesSchema,
  DeleteAllDataRequest as DeleteAllDataRequestSchema,
  DeleteAllDataResult as DeleteAllDataResultSchema,
  ClientErrorReport as ClientErrorReportSchema,
  endpoints,
} from './contract.gen';

/** A task read from text, before it is saved (POST /ai/parse, /ai/parse-list). */
export type TaskDraft = ImportDraft;

export type {
  AuthResult,
  CalendarFeed,
  ClientErrorReport,
  CompleteResult,
  DeleteAllDataResult,
  ExportFormat,
  ExportResult,
  ImportDraft,
  ListSummary,
  OkResult,
  Category,
  CreateCategoryRequest,
  CreateTaskStructuredRequest,
  DefaultView,
  DeleteResult,
  ParsedTask,
  Priority,
  Recurrence,
  RecurrenceInput,
  RecurrenceType,
  Settings,
  SourceType,
  Task,
  TaskKind,
  TaskSource,
  TaskStatus,
  TaskView,
  UpdateCategoryRequest,
  UpdateSettingsRequest,
  UpdateTaskRequest,
  User,
} from './contract.gen';
