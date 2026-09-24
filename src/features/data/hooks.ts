import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/shared/api';
import type { CalendarFeed } from '@/shared/api';

export const calendarFeedKey = ['calendar-feed'] as const;

export function useCalendarFeed() {
  return useQuery({ queryKey: calendarFeedKey, queryFn: () => api.getCalendarFeed() });
}

/** On, or a new link (the old one stops working). */
export function useEnableCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.enableCalendarFeed(),
    onSuccess: (feed) => qc.setQueryData<CalendarFeed>(calendarFeedKey, feed),
  });
}

export function useDisableCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.disableCalendarFeed(),
    onSuccess: (feed) => qc.setQueryData<CalendarFeed>(calendarFeedKey, feed),
  });
}

export function useExportData() {
  return useMutation({ mutationFn: (format: api.ExportFormat) => api.exportData(format) });
}

/**
 * "Delete all my data": every task, the categories, conversation memory, the
 * calendar link; settings back to the defaults (the account stays). Every
 * cached query is reset afterwards, so the app shows an empty Today.
 */
export function useDeleteAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAllData(),
    onSuccess: async () => {
      await qc.resetQueries();
    },
  });
}

export function useParseList() {
  return useMutation({ mutationFn: (text: string) => api.parseList(text) });
}

export function useImportTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tasks: api.StructuredTaskInput[]) => api.importTasks(tasks),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
