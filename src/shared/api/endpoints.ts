import { apiRequest } from './client';
import {
  DeleteResultSchema,
  ParsedTaskSchema,
  TaskListSchema,
  TaskSchema,
  UserSchema,
  type ParsedTask,
  type Task,
  type User,
} from './schemas';

export async function getMe(): Promise<User> {
  const data = await apiRequest<unknown>('GET', '/user/me');
  return UserSchema.parse(data);
}

export async function updateTimezone(timezone: string): Promise<User> {
  const data = await apiRequest<unknown>('PATCH', '/user/timezone', {
    body: { timezone },
  });
  return UserSchema.parse(data);
}

export async function listTasks(params?: {
  includeCompleted?: boolean;
}): Promise<Task[]> {
  const query = params?.includeCompleted
    ? { includeCompleted: 'true' }
    : undefined;
  const data = await apiRequest<unknown>('GET', '/tasks', { query });
  return TaskListSchema.parse(data).tasks;
}

export async function createTask(text: string): Promise<Task> {
  const data = await apiRequest<unknown>('POST', '/tasks', {
    body: { text },
  });
  return TaskSchema.parse(data);
}

export async function updateTask(
  id: string,
  patch: { description?: string; scheduledAt?: Date | string },
): Promise<Task> {
  const body: Record<string, unknown> = {};
  if (patch.description !== undefined) body['description'] = patch.description;
  if (patch.scheduledAt !== undefined) {
    body['scheduledAt'] =
      patch.scheduledAt instanceof Date
        ? patch.scheduledAt.toISOString()
        : patch.scheduledAt;
  }
  const data = await apiRequest<unknown>('PATCH', `/tasks/${id}`, { body });
  return TaskSchema.parse(data);
}

export async function completeTask(id: string): Promise<Task> {
  const data = await apiRequest<unknown>('POST', `/tasks/${id}/complete`);
  return TaskSchema.parse(data);
}

export async function delayTask(id: string, minutes: number): Promise<Task> {
  const data = await apiRequest<unknown>('POST', `/tasks/${id}/delay`, {
    body: { minutes },
  });
  return TaskSchema.parse(data);
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  const data = await apiRequest<unknown>('DELETE', `/tasks/${id}`);
  return DeleteResultSchema.parse(data);
}

export async function parseText(text: string): Promise<ParsedTask> {
  const data = await apiRequest<unknown>('POST', '/ai/parse', {
    body: { text },
  });
  return ParsedTaskSchema.parse(data);
}
