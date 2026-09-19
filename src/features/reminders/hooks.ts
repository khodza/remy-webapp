import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { create } from 'zustand';
import * as api from '@/shared/api';
import type { Task, TaskView } from '@/shared/api';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { toast } from '@/shared/ui';

/**
 * Tasks deleted in the app but still inside their Undo window: hidden from
 * every list (even after a refetch) until the delete is sent or undone.
 */
const usePendingDeletes = create<{ ids: string[] }>(() => ({ ids: [] }));

export interface TasksQueryVars {
  /** Server-side view; omitted = "all". */
  view?: TaskView;
  includeCompleted?: boolean;
  limit?: number;
}

export function tasksKey(vars: TasksQueryVars = {}): QueryKey {
  return [
    'tasks',
    {
      view: vars.view ?? 'all',
      includeCompleted: vars.includeCompleted ?? false,
      limit: vars.limit ?? null,
    },
  ];
}

export function taskKey(id: string): QueryKey {
  return ['task', id];
}

export function useTasks(
  vars: TasksQueryVars = {},
  options: { enabled?: boolean } = {},
) {
  const hidden = usePendingDeletes((s) => s.ids);
  const select = useCallback(
    (tasks: Task[]) => (hidden.length === 0 ? tasks : tasks.filter((t) => !hidden.includes(t.id))),
    [hidden],
  );
  return useQuery({
    queryKey: tasksKey(vars),
    queryFn: () => api.listTasks(vars),
    enabled: options.enabled ?? true,
    select,
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

/** Apply `fn` to every cached task list (any view / variant). */
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

/**
 * Write one task into the detail cache and every list that contains it.
 * Lists are per-view, so membership may be stale until the invalidation
 * that always follows refetches them.
 */
function syncTask(qc: QueryClient, updated: Task): void {
  qc.setQueryData<Task>(taskKey(updated.id), updated);
  patchLists(qc, (list) => list.map((t) => (t.id === updated.id ? updated : t)));
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
    mutationFn: ({ id, patch }: { id: string; patch: api.TaskPatch }) =>
      api.updateTask(id, patch),
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

/** Already-reviewed fields (Phase 5's token-based Create uses this). */
export function useCreateTaskStructured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.StructuredTaskInput) =>
      api.createTaskStructured(input),
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
      // Recurring tasks advance instead of completing, so only one-shots are
      // optimistically struck through; the response settles the rest.
      patchLists(qc, (list) =>
        list.map((task) =>
          task.id === id && !task.recurrence
            ? { ...task, status: 'completed', isOverdue: false }
            : task,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) restoreLists(qc, context.prev);
    },
    onSuccess: (updated) => syncTask(qc, updated),
    onSettled: (_data, _err, id) => invalidateTask(qc, id),
  });
}

export function useReopenTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.reopenTask(id),
    onSuccess: (updated) => {
      syncTask(qc, updated);
      invalidateTask(qc, updated.id);
    },
  });
}

export function useDelayTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      api.delayTask(id, minutes),
    onSuccess: (updated) => {
      syncTask(qc, updated);
      invalidateTask(qc, updated.id);
    },
  });
}

/** Absolute snooze: "Tonight 20:00", "Tomorrow 09:00". */
export function useSnoozeTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: Date }) =>
      api.snoozeTask(id, until),
    onSuccess: (updated) => {
      syncTask(qc, updated);
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

/**
 * Delete with Undo: the task disappears at once and the request is sent
 * when the toast times out (or the app is hidden). Undo just shows it again.
 */
export function useDeferredDelete() {
  const qc = useQueryClient();
  const haptic = useHapticFeedback();
  return (task: Task) => {
    haptic.notify('warning');
    usePendingDeletes.setState((s) => ({ ids: [...s.ids, task.id] }));
    const release = () => usePendingDeletes.setState((s) => ({ ids: s.ids.filter((id) => id !== task.id) }));
    const title = task.description.length > 40 ? `${task.description.slice(0, 39)}…` : task.description;
    toast({
      message: `Deleted “${title}”`,
      action: { label: 'Undo', onClick: release },
      onTimeout: () => {
        api.deleteTask(task.id).then(
          () => {
            // Drop it from the caches before un-hiding, so it can't flash back.
            patchLists(qc, (list) => list.filter((t) => t.id !== task.id));
            qc.removeQueries({ queryKey: taskKey(task.id) });
            release();
            void qc.invalidateQueries({ queryKey: ['tasks'] });
          },
          () => {
            release();
            toast({ message: `Couldn't delete “${title}”. It's back.`, tone: 'danger' });
          },
        );
      },
    });
  };
}
