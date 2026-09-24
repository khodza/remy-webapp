import { createPortal } from 'react-dom';
import { formatInTz } from '@/shared/lib/dates';
import { cx } from '@/shared/ui';
import type { CalendarDay, DayKey } from '../lib/day';

interface DayDropDockProps {
  days: CalendarDay[];
  tz: string;
  /** The day the row is being dragged from. */
  from: DayKey;
  /** The day under the finger. */
  over: string | null;
  /** Days that cannot take a reminder (already over). */
  closed: (key: DayKey) => boolean;
  /** What the drop will do, e.g. "Thu 25 Sep · 14:00". */
  hint: string;
}

/**
 * While a Week row is held, the week's days as big drop targets pinned
 * above the MainButton, so any day is in reach without scrolling.
 */
export function DayDropDock({ days, tz, from, over, closed, hint }: DayDropDockProps) {
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-30 px-3 [animation:remy-toast-in_.16s_ease-out]"
      style={{
        bottom: 'calc(var(--tg-viewport-safe-area-inset-bottom, 0px) + var(--dev-main-button-space, 0px) + 12px)',
      }}
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-2xl border border-rule bg-surface p-2 shadow-[0_10px_30px_rgb(16_24_40/0.18)]">
        <p className="tnum truncate px-1 pb-1.5 text-[12px] font-extrabold text-muted">{hint}</p>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isFrom = day.key === from;
            const shut = closed(day.key);
            const target = !isFrom && !shut;
            return (
              <div
                key={day.key}
                {...(target ? { 'data-drop-day': day.key } : {})}
                aria-label={formatInTz(day.start, tz, 'EEEE d MMMM')}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center rounded-xl text-center leading-tight transition',
                  over === day.key
                    ? 'scale-105 bg-accent text-accent-fg'
                    : target
                      ? 'bg-accent-soft text-accent'
                      : 'bg-past text-faint',
                )}
              >
                <span className="text-[11px] font-extrabold uppercase">{formatInTz(day.start, tz, 'EEE')}</span>
                <span className="tnum text-[15px] font-extrabold">{formatInTz(day.start, tz, 'd')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
