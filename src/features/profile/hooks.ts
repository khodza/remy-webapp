import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as api from '@/shared/api';
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
      // Keep auth-store user in sync so any cached consumers see the new tz.
      const { hydrate, token, expiresAt } = useAuthStore.getState();
      if (token && expiresAt) {
        hydrate({ token, expiresAt, user });
      }
    },
  });
}
