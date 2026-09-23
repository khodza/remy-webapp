import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ParsedTask } from '@/shared/api';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { PARSE_DEBOUNCE_MS, PARSE_MIN_LENGTH, parseQuery } from './api';

export interface ParsePreview {
  /** What the parser made of the current text (undefined while too short). */
  parsed: ParsedTask | undefined;
  /** Typing, or a parse of the latest text is on its way. */
  understanding: boolean;
  /** The last parse failed (the page offers the manual fields). */
  failed: boolean;
}

/**
 * Live "what Remy understood" for a sentence: debounced, cancelled when
 * superseded, and the previous result stays on screen while the next one
 * loads so the tokens do not flicker.
 */
export function useParsePreview(text: string): ParsePreview {
  const trimmed = text.trim();
  const debounced = useDebouncedValue(trimmed, PARSE_DEBOUNCE_MS);
  const parse = useQuery({
    ...parseQuery(debounced),
    enabled: debounced.length >= PARSE_MIN_LENGTH,
    placeholderData: keepPreviousData,
  });
  const long = trimmed.length >= PARSE_MIN_LENGTH;
  const understanding = long && (debounced !== trimmed || parse.isFetching);
  return {
    parsed: long ? parse.data : undefined,
    understanding,
    failed: parse.isError && !understanding,
  };
}
