import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** Pull-to-refresh on a list screen: refetch every query it shows. */
export function useRefreshScreen(): () => Promise<unknown> {
  const qc = useQueryClient();
  return useCallback(() => qc.refetchQueries({ type: 'active' }), [qc]);
}
