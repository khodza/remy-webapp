import { useQuery } from '@tanstack/react-query';
import * as api from '@/shared/api';

export const listsKey = ['lists'] as const;

/** Every named list ("shopping") with its pending and completed counts. */
export function useLists() {
  return useQuery({
    queryKey: listsKey,
    queryFn: () => api.listLists(),
    staleTime: 60_000,
  });
}
