import { useRef } from 'react';
import { formatInTz } from '@/shared/lib/dates';
import { cx } from '@/shared/ui';
import type { DayKey, WeekDay } from '../lib/day';

interface WeekStripProps {
  days: WeekDay[];
  selected: DayKey;
  today: DayKey;
  tz: string;
  onSelect: (key: DayKey) => void;
  /** -1 / +1: swipe to the previous / next week. */
  onShiftWeek: (weeks: number) => void;
}

/** Seven days with load dots; red when something on that day is overdue. */
export function WeekStrip({ days, selected, today, tz, onSelect, onShiftWeek }: WeekStripProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className="grid touch-pan-y grid-cols-7 gap-1 px-3 pb-2.5"
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onShiftWeek(dx < 0 ? 1 : -1);
      }}
    >
      {days.map((day) => {
        const on = day.key === selected;
        const dots = Math.min(3, day.count);
        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect(day.key)}
            aria-pressed={on}
            aria-label={`${formatInTz(day.start, tz, 'EEEE d MMMM')}, ${day.count} reminders${day.overdue ? ', some overdue' : ''}`}
            className={cx(
              'flex min-h-14 flex-col items-center rounded-xl pb-1 pt-1.5 text-[15px] font-extrabold transition',
              on ? 'bg-accent text-accent-fg' : day.key === today ? 'text-accent' : 'text-text active:bg-past',
            )}
          >
            <span className={cx('text-[10px] font-extrabold tracking-[0.06em]', on ? 'text-accent-fg' : 'text-muted')}>
              {formatInTz(day.start, tz, 'EEE').toUpperCase()}
            </span>
            <span className="tnum">{formatInTz(day.start, tz, 'd')}</span>
            <span className="mt-1 flex h-1 gap-0.5" aria-hidden="true">
              {Array.from({ length: dots }, (_, i) => (
                <i key={i} className={cx('h-1 w-1 rounded-full', on ? 'bg-accent-fg' : i === 0 && day.overdue ? 'bg-danger' : 'bg-faint')} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
