import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMainButtonStore } from '@/shared/lib/telegram';
import { mockApi, signIn } from '@/test/api';
import { renderWithProviders } from '@/test/render';
import { ImportPage } from './ImportPage';

const draft = (description: string, scheduledAt: string | null) => ({
  description,
  notes: null,
  scheduledAt,
  allDay: false,
  recurrence: null,
  priority: 'normal',
  categoryId: null,
  leadMinutes: null,
  list: null,
});

describe('Import: past times', () => {
  beforeEach(() => signIn());
  afterEach(() => vi.unstubAllGlobals());

  it('blocks Add while a ticked line has a time that already passed', async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const { calls } = mockApi({
      'GET /categories': { categories: [] },
      'POST /ai/parse-list': {
        tasks: [draft('Call the bank', past), draft('Dentist', future), draft('Buy milk', null)],
      },
    });
    renderWithProviders(<ImportPage />, { route: '/settings/import' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Your list' }), {
      target: { value: 'call the bank at 9\ndentist tomorrow\nbuy milk' },
    });
    await act(async () => useMainButtonStore.getState().onClick?.());
    await screen.findByText(/^3 found/);

    await waitFor(() => expect(useMainButtonStore.getState().text).toBe('Fix 1 past time'));
    expect(useMainButtonStore.getState().enabled).toBe(false);
    expect(screen.getByText(/One time has already passed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Call the bank: the time has passed/ })).toBeTruthy();

    // Leaving the line out unblocks the rest.
    fireEvent.click(screen.getByRole('button', { name: 'Skip Call the bank' }));
    await waitFor(() => expect(useMainButtonStore.getState().text).toBe('Add 2 reminders'));
    expect(useMainButtonStore.getState().enabled).toBe(true);
    expect(calls.some((c) => c.path === '/tasks/import')).toBe(false);
  });
});
