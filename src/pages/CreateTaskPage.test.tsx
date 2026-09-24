import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PARSE_DEBOUNCE_MS } from '@/features/ai';
import { deferred, mockApi, signIn } from '@/test/api';
import { renderWithProviders } from '@/test/render';
import { CreateTaskPage } from './CreateTaskPage';

const draft = (description: string, iso: string | null) => ({
  description,
  notes: null,
  scheduledAt: iso,
  allDay: false,
  recurrence: null,
  priority: 'normal',
  categoryId: null,
  leadMinutes: null,
  list: null,
});
/** The 2.4.0 shape: the first draft's fields on top, every draft in `drafts`. */
const parsed = (description: string, iso: string | null) => ({
  ...draft(description, iso),
  drafts: [draft(description, iso)],
});

function type(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /What should Remy/ }), { target: { value: text } });
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('Create: parse preview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-23T08:00:00Z') });
    signIn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for a pause before parsing, and parses the settled text once', async () => {
    const { calls } = mockApi({
      'GET /categories': { categories: [] },
      'GET /tasks': { tasks: [] },
      'POST /ai/parse': ({ body }) => parsed((body as { text: string }).text, '2026-09-24T17:00:00.000Z'),
    });
    renderWithProviders(<CreateTaskPage />, { route: '/create' });
    const parses = () => calls.filter((c) => c.path === '/ai/parse');

    type('call');
    await wait(300);
    type('call mom');
    await wait(300);
    type('call mom tomorrow at 17');
    await wait(PARSE_DEBOUNCE_MS - 50);
    expect(parses()).toHaveLength(0);

    await wait(100);
    expect(parses()).toHaveLength(1);
    expect(parses()[0]?.body).toEqual({ text: 'call mom tomorrow at 17' });
    // The request carries a signal so it can be cancelled.
    expect(parses()[0]?.signal).toBeInstanceOf(AbortSignal);

    await wait(10);
    expect(screen.getByLabelText('What Remy understood').textContent).toContain('17:00');
  });

  it('cancels a parse the user typed past', async () => {
    const first = deferred<unknown>();
    const { calls } = mockApi({
      'GET /categories': { categories: [] },
      'GET /tasks': { tasks: [] },
      'POST /ai/parse': ({ body }) => {
        const { text } = body as { text: string };
        return text.endsWith('17') ? first.promise : parsed(text, '2026-09-24T18:00:00.000Z');
      },
    });
    renderWithProviders(<CreateTaskPage />, { route: '/create' });
    const parses = () => calls.filter((c) => c.path === '/ai/parse');

    type('call mom tomorrow at 17');
    await wait(PARSE_DEBOUNCE_MS + 10);
    expect(parses()).toHaveLength(1);
    expect(screen.getByText('Understanding…', { selector: 'span' })).toBeTruthy();

    type('call mom tomorrow at 18');
    await wait(PARSE_DEBOUNCE_MS + 10);
    expect(parses()).toHaveLength(2);
    expect(parses()[0]?.signal?.aborted).toBe(true);
    expect(parses()[1]?.signal?.aborted).toBe(false);

    // The stale answer arriving late changes nothing.
    first.resolve(parsed('call mom', '2026-09-24T17:00:00.000Z'));
    await wait(10);
    const understood = screen.getByLabelText('What Remy understood').textContent ?? '';
    expect(understood).toContain('18:00');
    expect(understood).not.toContain('17:00');
  });
});
