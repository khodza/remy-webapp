import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleStatus } from '@/shared/api';
import { useMainButtonStore } from '@/shared/lib/telegram';
import { flushToast, Toaster } from '@/shared/ui';
import { deferred, mockApi, signIn } from '@/test/api';
import { renderWithProviders } from '@/test/render';
import { GoogleCalendarPage } from './GoogleCalendarPage';

const CONNECTED: GoogleStatus = {
  configured: true,
  connected: true,
  email: 'ada@gmail.com',
  calendars: [
    { id: 'ada@gmail.com', summary: 'Personal', selected: true },
    { id: 'work@group.calendar.google.com', summary: 'Work', selected: false },
  ],
};

function failure(status: number, code: string) {
  return new Response(JSON.stringify({ statusCode: status, error: code, message: code }), { status });
}

function renderPage() {
  return renderWithProviders(
    <>
      <GoogleCalendarPage />
      <Toaster />
    </>,
    { route: '/settings/google' },
  );
}

const toastText = () => screen.getByRole('status').textContent ?? '';

describe('Google Calendar: before it is connected', () => {
  beforeEach(() => signIn());
  afterEach(() => {
    flushToast();
    vi.unstubAllGlobals();
  });

  it('explains the missing server config and shows no main button', async () => {
    mockApi({ 'GET /integrations/google/status': { configured: false, connected: false } });
    renderPage();
    await screen.findByText(/Not set up on this server yet/);
    expect(screen.getByText('GOOGLE_CLIENT_ID').tagName).toBe('CODE');
    expect(useMainButtonStore.getState().visible).toBe(false);
  });

  it('connects: POST, opens the consent URL, then a refresh finds the account', async () => {
    let status: GoogleStatus = { configured: true, connected: false };
    const opened = vi.fn(() => ({}) as Window);
    vi.stubGlobal('open', opened);
    const { calls } = mockApi({
      'GET /integrations/google/status': () => status,
      'POST /integrations/google/connect': () => {
        status = CONNECTED;
        return { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed' };
      },
    });
    renderPage();
    await screen.findByRole('button', { name: /I've connected, refresh/ });
    expect(useMainButtonStore.getState().text).toBe('Connect Google Calendar');
    expect(useMainButtonStore.getState().visible).toBe(true);

    await act(async () => useMainButtonStore.getState().onClick?.());
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    await waitFor(() =>
      expect(opened).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
        '_blank',
        'noopener',
      ),
    );
    const waitingRow = await screen.findByRole('button', { name: /Waiting for Google/ });

    fireEvent.click(waitingRow);
    await screen.findByText('ada@gmail.com');
    expect(toastText()).toBe('Connected as ada@gmail.com');
    expect(useMainButtonStore.getState().visible).toBe(false);
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });

  it('tells the owner when the server has no Google client (409)', async () => {
    mockApi({
      'GET /integrations/google/status': { configured: true, connected: false },
      'POST /integrations/google/connect': () => failure(409, 'CONFLICT'),
    });
    renderPage();
    await screen.findByRole('button', { name: /I've connected, refresh/ });
    await act(async () => useMainButtonStore.getState().onClick?.());
    await waitFor(() => expect(toastText()).toBe('Google Calendar is not set up on the server yet.'));
    expect(screen.queryByText(/Waiting for Google/)).toBeNull();
  });
});

describe('Google Calendar: connected', () => {
  beforeEach(() => signIn());
  afterEach(() => {
    flushToast();
    vi.unstubAllGlobals();
  });

  it('lists the calendars and ticks one optimistically with a PATCH of every selected id', async () => {
    let status = CONNECTED;
    const held = deferred<GoogleStatus>();
    const { calls } = mockApi({
      'GET /integrations/google/status': () => status,
      'PATCH /integrations/google': ({ body }) => {
        const ids = (body as { calendarIds: string[] }).calendarIds;
        status = { ...status, calendars: status.calendars!.map((c) => ({ ...c, selected: ids.includes(c.id) })) };
        return held.promise;
      },
    });
    renderPage();
    await screen.findByText('ada@gmail.com');
    const tick = () => screen.getByRole('button', { name: 'Work' }).getAttribute('aria-pressed');
    expect(tick()).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Work' }));
    // Ticked before the server answered.
    await waitFor(() => expect(tick()).toBe('true'));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      calendarIds: ['ada@gmail.com', 'work@group.calendar.google.com'],
    });
    expect(screen.queryByRole('status')).toBeNull();

    held.resolve(status);
    await waitFor(() => expect(toastText()).toBe('Work added to the brief'));
    expect(tick()).toBe('true');
  });

  it('puts the tick back and says so when Google does not answer (502)', async () => {
    const held = deferred<Response>();
    mockApi({
      'GET /integrations/google/status': CONNECTED,
      'PATCH /integrations/google': () => held.promise,
    });
    renderPage();
    await screen.findByText('ada@gmail.com');
    const tick = () => screen.getByRole('button', { name: 'Work' }).getAttribute('aria-pressed');
    fireEvent.click(screen.getByRole('button', { name: 'Work' }));
    await waitFor(() => expect(tick()).toBe('true'));

    held.resolve(failure(502, 'BAD_GATEWAY'));
    await waitFor(() => expect(toastText()).toBe("Google didn't answer. Try again in a moment."));
    await waitFor(() => expect(tick()).toBe('false'));
  });

  it('disconnects after the sheet is confirmed and offers Connect again', async () => {
    let status = CONNECTED;
    const { calls } = mockApi({
      'GET /integrations/google/status': () => status,
      'DELETE /integrations/google': () => {
        status = { configured: true, connected: false };
        return { success: true };
      },
    });
    renderPage();
    await screen.findByText('ada@gmail.com');
    expect(useMainButtonStore.getState().visible).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Google Calendar' }));
    const dialog = await screen.findByRole('dialog');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/integrations/google')).toBe(true),
    );
    await waitFor(() => expect(toastText()).toBe('Google Calendar disconnected.'));
    expect(dialog.isConnected).toBe(false);
    await screen.findByRole('button', { name: /I've connected, refresh/ });
    expect(useMainButtonStore.getState().visible).toBe(true);
  });

  it('shows the missing list when Google was unreachable', async () => {
    mockApi({ 'GET /integrations/google/status': { configured: true, connected: true, email: 'ada@gmail.com' } });
    renderPage();
    await screen.findByText(/calendar list is missing/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
