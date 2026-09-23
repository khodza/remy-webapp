import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeSettings, useClockFormatSync } from '@/features/settings';
import { DEFAULT_SETTINGS, type Settings, type UpdateSettingsRequest } from '@/shared/api';
import { setClockHour12 } from '@/shared/stores/clock.store';
import { mockApi, signIn, TEST_USER } from '@/test/api';
import { renderWithProviders } from '@/test/render';
import { SettingsPage } from './SettingsPage';

/** Root mounts the sync once; the page alone does not. */
function WithClockSync() {
  useClockFormatSync();
  return <SettingsPage />;
}

describe('Settings: time format', () => {
  let settings: Settings;
  beforeEach(() => {
    signIn();
    settings = { ...DEFAULT_SETTINGS, morningBrief: { enabled: true, time: '08:00' }, quietHours: { ...DEFAULT_SETTINGS.quietHours, from: '23:00', to: '07:00' } };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setClockHour12(false);
  });

  function api() {
    return mockApi({
      'GET /user/me': TEST_USER,
      'GET /settings': () => settings,
      'PATCH /settings': ({ body }) => {
        settings = mergeSettings(settings, body as UpdateSettingsRequest);
        return settings;
      },
      'GET /categories': { categories: [] },
      'GET /calendar/feed': { enabled: false, path: null },
    });
  }

  it('shows 24-hour times by default', async () => {
    api();
    renderWithProviders(<WithClockSync />, { route: '/settings' });
    const row = await screen.findByRole('button', { name: /Morning brief/ });
    expect(row.textContent).toContain('08:00');
    expect(screen.getByRole('radio', { name: '24 h' }).getAttribute('aria-checked')).toBe('true');
  });

  it('switches every time to 12-hour and saves hour12', async () => {
    const { calls } = api();
    renderWithProviders(<WithClockSync />, { route: '/settings' });
    await screen.findByRole('button', { name: /Morning brief/ });

    fireEvent.click(screen.getByRole('radio', { name: '12 h' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.path === '/settings')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ hour12: true });
    expect(screen.getByRole('radio', { name: '12 h' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: /Morning brief/ }).textContent).toContain('8:00 AM');
    expect(screen.getByRole('button', { name: /Quiet hours/ }).textContent).toContain('11:00 PM – 7:00 AM');
    expect(screen.getByText(/^Now \d{1,2}:\d{2} (AM|PM)$/)).toBeTruthy();
  });

  it('opens in 12-hour when the account says so', async () => {
    settings = { ...settings, hour12: true };
    api();
    renderWithProviders(<WithClockSync />, { route: '/settings' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Evening review/ }).textContent).toContain('9:00 PM'));
    expect(screen.getByRole('radio', { name: '12 h' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Settings: compact rows', () => {
  beforeEach(() => signIn());
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.density;
  });

  it('is a device preference: data-density on <html> and localStorage, no PATCH', async () => {
    const { calls } = mockApi({
      'GET /user/me': TEST_USER,
      'GET /settings': DEFAULT_SETTINGS,
      'GET /categories': { categories: [] },
      'GET /calendar/feed': { enabled: false, path: null },
    });
    renderWithProviders(<SettingsPage />, { route: '/settings' });
    const toggle = await screen.findByRole('switch', { name: 'Compact rows' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(window.localStorage.getItem('remy.density')).toBe('compact');
    expect(screen.getByRole('switch', { name: 'Compact rows' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('switch', { name: 'Compact rows' }));
    expect(document.documentElement.dataset.density).toBeUndefined();
    expect(window.localStorage.getItem('remy.density')).toBeNull();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});
