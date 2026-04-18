import {
  useMutation,
  useQuery,
  useQueryClient,
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

export function useTasks(vars: TasksQueryVars = {}) {
  return useQuery({
    queryKey: tasksKey(vars),
    queryFn: () => api.listTasks(vars),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => {
      if (!id) throw new Error('Task id missing');
      return api.listTasks({ includeCompleted: true }).then((tasks) => {
        const found = tasks.find((task) => task.id === id);
        if (!found) throw new Error('Task not found');
        return found;
      });
    },
    enabled: Boolean(id),
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
      patch: { description?: string; scheduledAt?: Date };
    }) => api.updateTask(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Task>(['task', updated.id], updated);
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.createTask(text),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateTaskFromVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blob: Blob) => api.createTaskFromVoice(blob),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCompleteTask(vars: TasksQueryVars = {}) {
  const qc = useQueryClient();
  const key = tasksKey(vars);
  return useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((task) =>
          task.id === id ? { ...task, status: 'completed' } : task,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData<Task[]>(key, context.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDelayTask(vars: TasksQueryVars = {}) {
  const qc = useQueryClient();
  const key = tasksKey(vars);
  return useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      api.delayTask(id, minutes),
    onSuccess: (updated) => {
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((task) => (task.id === updated.id ? updated : task)),
      );
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask(vars: TasksQueryVars = {}) {
  const qc = useQueryClient();
  const key = tasksKey(vars);
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).filter((task) => task.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData<Task[]>(key, context.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
