import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PARSE_DEBOUNCE_MS } from '@/features/ai';
import { useMainButtonStore } from '@/shared/lib/telegram';
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

describe('Create: the 2.4.0 parse', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-23T08:00:00Z') });
    signIn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('takes lead time, priority, list and "no time" from the parse instead of hard-coding them', async () => {
    const { calls } = mockApi({
      'GET /categories': { categories: [] },
      'GET /tasks': { tasks: [] },
      'GET /lists': { lists: [] },
      'POST /ai/parse': {
        ...draft('Buy milk', null),
        priority: 'high',
        list: 'shopping',
        drafts: [{ ...draft('Buy milk', null), priority: 'high', list: 'shopping' }],
      },
      'POST /tasks/structured': ({ body }) => ({
        id: '64b000000000000000000001',
        description: (body as { description: string }).description,
        notes: null,
        kind: 'todo',
        scheduledAt: null,
        timezone: 'UTC',
        allDay: false,
        list: 'shopping',
        snoozedUntil: null,
        nextFireAt: null,
        leadMinutes: null,
        status: 'pending',
        priority: 'high',
        categoryId: null,
        recurrence: null,
        source: { type: 'miniapp', originalText: 'buy milk', messageId: null, forwardedFrom: null },
        completedAt: null,
        completionsCount: 0,
        completions: [],
        snoozeCount: 0,
        isOverdue: false,
        createdAt: '2026-09-23T08:00:00.000Z',
        updatedAt: '2026-09-23T08:00:00.000Z',
      }),
    });
    renderWithProviders(<CreateTaskPage />, { route: '/create' });
    type('buy milk to the shopping list!');
    await wait(PARSE_DEBOUNCE_MS + 20);
    await wait(20);

    const understood = screen.getByLabelText('What Remy understood').textContent ?? '';
    expect(understood).toContain('Inbox for now');
    expect(understood).toContain('Shopping');
    expect(understood).toContain('High');
    expect(useMainButtonStore.getState().text).toBe('Add to Inbox');

    await act(async () => useMainButtonStore.getState().onClick?.());
    await wait(50);
    expect(calls.some((c) => c.path === '/tasks/structured')).toBe(true);
    const sent = calls.find((c) => c.path === '/tasks/structured')?.body as Record<string, unknown>;
    expect(sent).toMatchObject({ description: 'Buy milk', scheduledAt: null, priority: 'high', list: 'shopping' });
    expect(sent).not.toHaveProperty('allDay');
  });

  it("shows the assistant's reason inline when the text is not a reminder (422)", async () => {
    mockApi({
      'GET /categories': { categories: [] },
      'GET /tasks': { tasks: [] },
      'GET /lists': { lists: [] },
      'POST /ai/parse': () =>
        new Response(
          JSON.stringify({ statusCode: 422, error: 'UNPROCESSABLE_ENTITY', message: 'That reads like a greeting.' }),
          { status: 422 },
        ),
    });
    renderWithProviders(<CreateTaskPage />, { route: '/create' });
    type('hello there');
    await wait(PARSE_DEBOUNCE_MS + 20);
    await wait(20);
    expect(screen.getByRole('status').textContent).toContain('That reads like a greeting.');
    expect(screen.queryByText(/Couldn't read a time/)).toBeNull();
    // The text can still be added by hand, as it is.
    expect(screen.getByLabelText('What Remy understood').textContent).toContain('hello there');
    expect(useMainButtonStore.getState().text).toBe('Add to Inbox');
    expect(useMainButtonStore.getState().enabled).toBe(true);
  });

  it('turns several drafts into a review list and adds them in one request', async () => {
    const { calls } = mockApi({
      'GET /categories': { categories: [] },
      'GET /tasks': { tasks: [] },
      'POST /ai/parse': {
        ...draft('Buy milk', null),
        drafts: [draft('Buy milk', null), draft('Call mom', '2026-09-24T17:00:00.000Z')],
      },
      'POST /tasks/import': { tasks: [] },
    });
    renderWithProviders(<CreateTaskPage />, { route: '/create' });
    type('buy milk and call mom tomorrow at 5');
    await wait(PARSE_DEBOUNCE_MS + 20);
    await wait(20);

    expect(screen.getByText(/^2 reminders · 2 to add/)).toBeTruthy();
    expect(useMainButtonStore.getState().text).toBe('Add 2 reminders');
    fireEvent.click(screen.getByRole('button', { name: 'Skip Buy milk' }));
    expect(useMainButtonStore.getState().text).toBe('Add 1 reminder');

    await act(async () => useMainButtonStore.getState().onClick?.());
    await wait(50);
    expect(calls.some((c) => c.path === '/tasks/import')).toBe(true);
    const sent = calls.find((c) => c.path === '/tasks/import')?.body as { tasks: Array<Record<string, unknown>> };
    expect(sent.tasks).toHaveLength(1);
    expect(sent.tasks[0]).toMatchObject({ description: 'Call mom', scheduledAt: '2026-09-24T17:00:00.000Z' });
  });
});
