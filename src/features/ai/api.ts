import { queryOptions } from '@tanstack/react-query';
import * as api from '@/shared/api';

/** Shorter sentences are not worth a paid parse. */
export const PARSE_MIN_LENGTH = 4;
/** Parse once the user pauses, not on every keystroke (F13). */
export const PARSE_DEBOUNCE_MS = 800;

export const parseKey = (text: string) => ['parse', text] as const;

/**
 * The parse preview for one settled sentence. React Query hands the query
 * an AbortSignal; when the sentence changes the old query loses its
 * observer and the request is cancelled instead of finishing unseen.
 */
export function parseQuery(text: string) {
  return queryOptions({
    queryKey: parseKey(text),
    queryFn: ({ signal }) => api.parseText(text, { signal }),
    // The same sentence parses the same way for a while; retyping it is free.
    staleTime: 60_000,
    retry: 0,
  });
}
