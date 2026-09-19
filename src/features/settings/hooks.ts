import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/shared/api';
import type { Settings, UpdateSettingsRequest } from '@/shared/api';

export const settingsKey = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => api.getSettings(),
    staleTime: 5 * 60_000,
  });
}

/** Same deep-merge the server applies: nested objects merge key by key. */
export function mergeSettings(
  current: Settings,
  patch: UpdateSettingsRequest,
): Settings {
  return {
    ...current,
    ...(patch.hour12 !== undefined ? { hour12: patch.hour12 } : {}),
    ...(patch.weekStartsOn !== undefined
      ? { weekStartsOn: patch.weekStartsOn }
      : {}),
    ...(patch.defaultView !== undefined
      ? { defaultView: patch.defaultView }
      : {}),
    morningBrief: { ...current.morningBrief, ...patch.morningBrief },
    eveningReview: { ...current.eveningReview, ...patch.eveningReview },
    quietHours: { ...current.quietHours, ...patch.quietHours },
    escalation: { ...current.escalation, ...patch.escalation },
    weeklyWrap: { ...current.weeklyWrap, ...patch.weeklyWrap },
  };
}

/** Optimistic: toggles feel instant; a failure rolls back. */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateSettingsRequest) => api.updateSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: settingsKey });
      const prev = qc.getQueryData<Settings>(settingsKey);
      if (prev) qc.setQueryData<Settings>(settingsKey, mergeSettings(prev, patch));
      return { prev };
    },
    onError: (_err, _patch, context) => {
      if (context?.prev) qc.setQueryData<Settings>(settingsKey, context.prev);
    },
    onSuccess: (settings) => qc.setQueryData<Settings>(settingsKey, settings),
  });
}
