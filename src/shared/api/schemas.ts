import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'pending',
  'completed',
  'overdue',
  'deleted',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const RecurrenceTypeSchema = z.enum([
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'every_n_days',
]);
export type RecurrenceType = z.infer<typeof RecurrenceTypeSchema>;

export const RecurrenceSchema = z.object({
  type: RecurrenceTypeSchema,
  intervalDays: z.number().int().positive().optional(),
});
export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  scheduledAt: z.coerce.date(),
  status: TaskStatusSchema,
  recurrence: RecurrenceSchema.nullable().optional(),
  /** IANA zone the task was created in (older backends omit it). */
  timezone: z.string().optional(),
  /** Set when a recurring task was delayed; the series time stays put. */
  snoozedUntil: z.coerce.date().nullable().optional(),
  /** When the reminder actually fires: snoozedUntil ?? scheduledAt. */
  nextFireAt: z.coerce.date().optional(),
  isOverdue: z.boolean().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskListSchema = z.object({
  tasks: z.array(TaskSchema),
});

export const UserSchema = z.object({
  id: z.string(),
  telegramUserId: z.number(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  timezone: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthResultSchema = z.object({
  token: z.string(),
  expiresAt: z.coerce.date(),
  user: UserSchema,
});
export type AuthResult = z.infer<typeof AuthResultSchema>;

export const ParsedTaskSchema = z.object({
  description: z.string(),
  scheduledAt: z.coerce.date(),
  recurrence: RecurrenceSchema.nullable().optional(),
});
export type ParsedTask = z.infer<typeof ParsedTaskSchema>;

export const DeleteResultSchema = z.object({
  success: z.boolean(),
});
