import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import type { GoogleStatus } from '@/shared/api';
import {
  CONNECT_POLL_MS,
  connectPollInterval,
  googleFailureMessage,
  toggleCalendar,
  withCalendarSelected,
} from './google';

const connected: GoogleStatus = {
  configured: true,
  connected: true,
  email: 'ada@example.com',
  calendars: [
    { id: 'ada@example.com', summary: 'ada@example.com', selected: true },
    { id: 'work', summary: 'Work', selected: false },
  ],
};

describe('connectPollInterval', () => {
  it('is off until Connect was tapped', () => {
    expect(connectPollInterval(null, { connected: false }, 1000)).toBe(false);
  });
  it('polls every 5 s inside the window while nothing is connected', () => {
    expect(connectPollInterval(120_000, { connected: false }, 1000)).toBe(CONNECT_POLL_MS);
    expect(connectPollInterval(120_000, undefined, 1000)).toBe(CONNECT_POLL_MS);
  });
  it('stops once the account is connected or the window has passed', () => {
    expect(connectPollInterval(120_000, { connected: true }, 1000)).toBe(false);
    expect(connectPollInterval(120_000, { connected: false }, 120_000)).toBe(false);
  });
});

describe('toggleCalendar', () => {
  it('adds a calendar to the selected ids and removes it again', () => {
    expect(toggleCalendar(connected.calendars!, 'work', true)).toEqual(['ada@example.com', 'work']);
    expect(toggleCalendar(connected.calendars!, 'ada@example.com', false)).toEqual([]);
  });
  it('flips one tick in the status without touching the rest', () => {
    const next = withCalendarSelected(connected, 'work', true);
    expect(next.calendars?.map((c) => c.selected)).toEqual([true, true]);
    expect(connected.calendars?.[1]?.selected).toBe(false);
    expect(withCalendarSelected({ configured: true, connected: true }, 'work', true).calendars).toBeUndefined();
  });
});

describe('googleFailureMessage', () => {
  it('names the server-side gap on 409 and Google on 502', () => {
    expect(googleFailureMessage('connect', new ApiError(409, 'CONFLICT', 'x'))).toMatch(/not set up on the server/);
    expect(googleFailureMessage('select', new ApiError(502, 'BAD_GATEWAY', 'x'))).toMatch(/Google didn't answer/);
  });
  it('explains a lost connection and an unknown calendar', () => {
    expect(googleFailureMessage('select', new ApiError(404, 'NOT_FOUND', 'x'))).toMatch(/No Google account/);
    expect(googleFailureMessage('select', new ApiError(400, 'BAD_REQUEST', 'x'))).toMatch(/doesn't list that calendar/);
  });
  it('falls back to a sentence per action', () => {
    expect(googleFailureMessage('connect', new Error('boom'))).toMatch(/sign-in/);
    expect(googleFailureMessage('disconnect', new ApiError(0, 'NETWORK_ERROR', 'x'))).toMatch(/disconnect/);
    expect(googleFailureMessage('status', undefined)).toMatch(/check the Google connection/);
  });
});
