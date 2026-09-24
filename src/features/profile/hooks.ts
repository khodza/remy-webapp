import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as api from '@/shared/api';
import { getDeviceTimezone } from '@/shared/lib/dates';
import { useAuthStore } from '@/shared/stores/auth.store';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api.getMe(),
  });
}

export function useUpdateTimezone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (timezone: string) => api.updateTimezone(timezone),
    onSuccess: (user) => {
      qc.setQueryData(meKey, user);
      // Keep auth-store user in sync so useUserTimezone() sees the new zone.
      const { hydrate, token, expiresAt } = useAuthStore.getState();
      if (token && expiresAt) {
        hydrate({ token, expiresAt, user });
      }
    },
  });
}

// Module-level so the detection runs once per app session, whatever mounts.
let timezoneAutoDetectDone = false;

/**
 * A fresh user has `timezone: null`, which makes the bot parse "5pm" in UTC.
 * Set the device zone once so both bot and app agree without a settings trip.
 */
export function useEnsureTimezone(): void {
  const me = useMe();
  const update = useUpdateTimezone();
  const mutate = update.mutate;

  useEffect(() => {
    if (timezoneAutoDetectDone) return;
    if (!me.data || me.data.timezone !== null) return;
    timezoneAutoDetectDone = true;
    mutate(getDeviceTimezone(), {
      onError: () => {
        // Allow another attempt later (e.g. after a transient network error).
        timezoneAutoDetectDone = false;
      },
    });
  }, [me.data, mutate]);
}
