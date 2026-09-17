import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import * as api from '@/shared/api';
import type { Task } from '@/shared/api';

export interface TasksQueryVars {
  includeCompleted?: boolean;
}

export function tasksKey(vars: TasksQueryVars = {}): QueryKey {
  return ['tasks', { includeCompleted: vars.includeCompleted ?? false }];
}

export function taskKey(id: string): QueryKey {
  return ['task', id];
}

export function useTasks(vars: TasksQueryVars = {}) {
  return useQuery({
    queryKey: tasksKey(vars),
    queryFn: () => api.listTasks(vars),
  });
}

/** Newest copy of a task from any cached list, plus when that list was fetched. */
function findCachedTask(
  qc: QueryClient,
  id: string,
): { task: Task; updatedAt: number } | undefined {
  let best: { task: Task; updatedAt: number } | undefined;
  for (const [key, list] of qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })) {
    const task = list?.find((t) => t.id === id);
    if (!task) continue;
    const updatedAt = qc.getQueryState(key)?.dataUpdatedAt ?? 0;
    if (!best || updatedAt > best.updatedAt) best = { task, updatedAt };
  }
  return best;
}

/** Apply `fn` to every cached task list (any includeCompleted variant). */
function patchLists(qc: QueryClient, fn: (list: Task[]) => Task[]): void {
  for (const [key, list] of qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })) {
    if (list) qc.setQueryData<Task[]>(key, fn(list));
  }
}

function snapshotLists(qc: QueryClient): Array<[QueryKey, Task[] | undefined]> {
  return qc.getQueriesData<Task[]>({ queryKey: ['tasks'] });
}

function restoreLists(
  qc: QueryClient,
  snapshot: Array<[QueryKey, Task[] | undefined]>,
): void {
  for (const [key, list] of snapshot) qc.setQueryData<Task[]>(key, list);
}

/** Write one task into the detail cache and every list that contains it. */
function syncTask(qc: QueryClient, updated: Task): void {
  qc.setQueryData<Task>(taskKey(updated.id), (old) =>
    old ? { ...old, ...updated } : updated,
  );
  patchLists(qc, (list) =>
    list.map((t) =>
      t.id === updated.id ? { ...t, ...updated, isOverdue: t.isOverdue } : t,
    ),
  );
}

function invalidateTask(qc: QueryClient, id?: string): void {
  void qc.invalidateQueries({ queryKey: ['tasks'] });
  if (id) void qc.invalidateQueries({ queryKey: taskKey(id) });
}

/**
 * Detail opens instantly from the already-loaded list (F5) and stays in
 * step with list-level actions (F11); GET /tasks/:id refreshes it.
 */
export function useTask(id: string | undefined) {
  const qc = useQueryClient();
  const cached = id ? findCachedTask(qc, id) : undefined;
  return useQuery({
    queryKey: taskKey(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Task id missing');
      return api.getTask(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
    ...(cached
      ? { initialData: cached.task, initialDataUpdatedAt: cached.updatedAt }
      : {}),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        description?: string;
        scheduledAt?: Date;
        recurrence?: api.Recurrence | null;
      };
    }) => api.updateTask(id, patch),
    onSuccess: (updated) => {
      syncTask(qc, updated);
      invalidateTask(qc, updated.id);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.createTask(text),
    onSuccess: () => invalidateTask(qc),
  });
}

export function useCreateTaskFromVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blob: Blob) => api.createTaskFromVoice(blob),
    onSuccess: () => invalidateTask(qc),
  });
}

// Every mutation updates all cached list variants, so the caller no longer
// has to say which list it is looking at (F12).
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = snapshotLists(qc);
      patchLists(qc, (list) =>
        list.map((task) =>
          task.id === id
            ? { ...task, status: 'completed', isOverdue: false }
            : task,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) restoreLists(qc, context.prev);
    },
    onSuccess: (updated) => syncTask(qc, { ...updated, isOverdue: false }),
    onSettled: (_data, _err, id) => invalidateTask(qc, id),
  });
}

export function useDelayTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      api.delayTask(id, minutes),
    onSuccess: (updated) => {
      // A snoozed task is no longer overdue until its new time.
      syncTask(qc, { ...updated, isOverdue: false });
      invalidateTask(qc, updated.id);
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = snapshotLists(qc);
      patchLists(qc, (list) => list.filter((task) => task.id !== id));
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) restoreLists(qc, context.prev);
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: taskKey(id) });
    },
    onSettled: () => invalidateTask(qc),
  });
}
