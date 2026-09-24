import { queryOptions } from '@tanstack/react-query';
import * as api from '@/shared/api';
import { connectPollInterval } from './lib/google';

export const googleStatusKey = ['google-status'] as const;

/**
 * GET /integrations/google/status. With `pollUntil` (a timestamp) it is
 * asked again every 5 s until the account is connected or the window ends:
 * the consent flow finishes in the system browser, outside the Mini App.
 */
export function googleStatusQuery(pollUntil: number | null = null) {
  return queryOptions({
    queryKey: googleStatusKey,
    queryFn: () => api.getGoogleStatus(),
    refetchInterval: (query) => connectPollInterval(pollUntil, query.state.data, Date.now()),
  });
}
