import { ApiError } from '@/shared/api';
import type { GoogleCalendarInfo, GoogleStatus } from '@/shared/api';

/** How often the status is asked for after Connect was tapped, and for how long. */
export const CONNECT_POLL_MS = 5_000;
export const CONNECT_POLL_WINDOW_MS = 120_000;

/**
 * The refetch interval while the owner is off in the browser giving consent:
 * every 5 s until the account shows up connected or the window closes.
 */
export function connectPollInterval(
  pollUntil: number | null,
  status: Pick<GoogleStatus, 'connected'> | undefined,
  now: number,
): number | false {
  if (pollUntil === null || now >= pollUntil) return false;
  if (status?.connected) return false;
  return CONNECT_POLL_MS;
}

/** The selected ids after one calendar is ticked or unticked. */
export function toggleCalendar(calendars: GoogleCalendarInfo[], id: string, selected: boolean): string[] {
  return calendars.filter((c) => (c.id === id ? selected : c.selected)).map((c) => c.id);
}

/** The status with one calendar's tick changed (the optimistic cache). */
export function withCalendarSelected(status: GoogleStatus, id: string, selected: boolean): GoogleStatus {
  return {
    ...status,
    ...(status.calendars ? { calendars: status.calendars.map((c) => (c.id === id ? { ...c, selected } : c)) } : {}),
  };
}

export type GoogleAction = 'connect' | 'disconnect' | 'select' | 'status';

/**
 * One sentence per failure. 409 = the server has no Google client (env),
 * 502 = Google itself did not answer, 404 = nothing is connected any more.
 */
export function googleFailureMessage(action: GoogleAction, error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 409) return 'Google Calendar is not set up on the server yet.';
  if (status === 502) return "Google didn't answer. Try again in a moment.";
  if (status === 404 && action !== 'status') return 'No Google account is connected. Connect one first.';
  if (status === 400 && action === 'select')
    return "Google doesn't list that calendar any more. Refresh and try again.";
  switch (action) {
    case 'connect':
      return "Couldn't start the Google sign-in. Try again.";
    case 'disconnect':
      return "Couldn't disconnect. Try again.";
    case 'select':
      return "Couldn't change the calendars. Try again.";
    default:
      return "Couldn't check the Google connection. Try again.";
  }
}
