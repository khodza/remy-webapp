import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@/shared/api';
import type { GoogleStatus } from '@/shared/api';
import { googleStatusKey, googleStatusQuery } from './api';
import { CONNECT_POLL_WINDOW_MS, toggleCalendar, withCalendarSelected } from './lib/google';

export function useGoogleStatus(pollUntil: number | null = null) {
  return useQuery(googleStatusQuery(pollUntil));
}

/**
 * Connect: POST for the consent URL (the page opens it), then the status is
 * polled for two minutes so the screen notices the account on its own;
 * `onConnected` fires once when it does (a toast).
 */
export function useConnectGoogle(onConnected?: (status: GoogleStatus) => void) {
  const [pollUntil, setPollUntil] = useState<number | null>(null);
  const status = useGoogleStatus(pollUntil);
  const connect = useMutation({
    mutationFn: () => api.connectGoogle(),
    onSuccess: () => setPollUntil(Date.now() + CONNECT_POLL_WINDOW_MS),
  });

  const notify = useRef(onConnected);
  notify.current = onConnected;
  const wasConnected = useRef<boolean | null>(null);
  useEffect(() => {
    const data = status.data;
    if (!data) return;
    if (wasConnected.current === false && data.connected) {
      setPollUntil(null);
      notify.current?.(data);
    }
    wasConnected.current = data.connected;
  }, [status.data]);

  const waiting = pollUntil !== null && !status.data?.connected;
  const stopWaiting = useCallback(() => setPollUntil(null), []);
  return { status, connect, waiting, stopWaiting };
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectGoogle(),
    onSuccess: () => {
      qc.setQueryData<GoogleStatus>(googleStatusKey, (old) => ({
        configured: old?.configured ?? true,
        connected: false,
      }));
      void qc.invalidateQueries({ queryKey: googleStatusKey });
    },
  });
}

/**
 * One tick at a time, optimistic: the row flips at once and comes back on
 * an error. Unticking the last calendar means "the primary one" on the
 * server, so the refetch afterwards shows what it decided.
 */
export function useSelectGoogleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, selected }: { id: string; selected: boolean }) => {
      const current = qc.getQueryData<GoogleStatus>(googleStatusKey);
      return api.selectGoogleCalendars(toggleCalendar(current?.calendars ?? [], id, selected));
    },
    onMutate: async ({ id, selected }) => {
      await qc.cancelQueries({ queryKey: googleStatusKey });
      const previous = qc.getQueryData<GoogleStatus>(googleStatusKey);
      if (previous) qc.setQueryData<GoogleStatus>(googleStatusKey, withCalendarSelected(previous, id, selected));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(googleStatusKey, context.previous);
    },
    onSuccess: (status) => {
      if (status) qc.setQueryData<GoogleStatus>(googleStatusKey, status);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: googleStatusKey }),
  });
}
