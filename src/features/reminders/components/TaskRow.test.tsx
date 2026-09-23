import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/test/fixtures';
import { TaskRow } from './TaskRow';

function setup(tone: 'overdue' | 'later' | 'done', patch = {}) {
  const handlers = { onOpen: vi.fn(), onToggle: vi.fn(), onSnooze: vi.fn() };
  const task = makeTask({ description: 'Pay the electricity bill', ...patch });
  render(<TaskRow task={task} tz="UTC" tone={tone} time="09:00" timeSub="2 h" {...handlers} />);
  return handlers;
}

describe('TaskRow', () => {
  it('opens on tap and on Enter', () => {
    const { onOpen, onToggle } = setup('later');
    const row = screen.getByRole('button', { name: /Pay the electricity bill/ });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('marks done without opening the row', () => {
    const { onOpen, onToggle } = setup('later');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('snoozes an overdue row by an hour without opening it, with a 44 px target', () => {
    const { onOpen, onSnooze } = setup('overdue');
    const plusOne = screen.getByRole('button', { name: 'Snooze one hour' });
    fireEvent.click(plusOne);
    expect(onSnooze).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(plusOne.className).toContain('min-h-11');
    expect(plusOne.className).toContain('min-w-11');
  });

  it('a done row offers reopen and no snooze', () => {
    const { onToggle } = setup('done', { status: 'completed' });
    expect(screen.queryByRole('button', { name: 'Snooze one hour' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as not done' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows repeat, heavy snoozing and forwarded as pills', () => {
    setup('later', {
      recurrence: { type: 'daily' },
      snoozeCount: 5,
      source: { type: 'forward', originalText: null, messageId: null, forwardedFrom: 'Bob' },
    });
    expect(screen.getByText(/Every day/)).toBeTruthy();
    expect(screen.getByText('snoozed ×5')).toBeTruthy();
    expect(screen.getByText(/forwarded/)).toBeTruthy();
  });
});
