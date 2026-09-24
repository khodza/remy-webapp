import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as api from '@/shared/api';
import type { Settings, UpdateSettingsRequest } from '@/shared/api';
import { setClockHour12 } from '@/shared/stores/clock.store';

export const settingsKey = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => api.getSettings(),
    staleTime: 5 * 60_000,
  });
}

/** Same deep-merge the server applies: nested objects merge key by key. */
export function mergeSettings(current: Settings, patch: UpdateSettingsRequest): Settings {
  return {
    ...current,
    ...(patch.hour12 !== undefined ? { hour12: patch.hour12 } : {}),
    ...(patch.weekStartsOn !== undefined ? { weekStartsOn: patch.weekStartsOn } : {}),
    ...(patch.defaultView !== undefined ? { defaultView: patch.defaultView } : {}),
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

/**
 * Keeps the app-wide 12/24-hour preference in step with the settings
 * query: the fetch, an optimistic change and its rollback all land in the
 * cache, and the cache event updates the clock store in the same tick, so
 * the Settings row and every time on screen switch together. Mounted once
 * (app/Root); it also loads settings at startup.
 */
export function useClockFormatSync(): void {
  const qc = useQueryClient();
  useSettings();
  useEffect(() => {
    const apply = () => {
      const settings = qc.getQueryData<Settings>(settingsKey);
      if (settings) setClockHour12(settings.hour12);
    };
    apply();
    return qc.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === settingsKey[0]) apply();
    });
  }, [qc]);
}
