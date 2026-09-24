import { Flag } from 'lucide-react';
import type { Category } from '@/shared/api';
import { formatHour, formatTime, relativeToNow, useHour12 } from '@/shared/lib/dates';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { cx } from '@/shared/ui';
import { minuteOfDay, type DayItem, type DayModel } from '../lib/day';
import { hourRange, layoutBlocks, snapMove } from '../lib/timeline';
import { useBlockGesture } from './useBlockGesture';

/** The hour labels' column; wider for "11:45 PM" in the NOW pill. */
const HOUR_COLUMN = { h24: 56, h12: 66 };

interface TimelineViewProps {
  day: DayModel;
  tz: string;
  now: Date;
  hourPx: number;
  categories: Map<string, Category>;
  emptyNote: string | null;
  onOpen: (item: DayItem) => void;
  onComplete: (item: DayItem) => void;
  onSnooze: (item: DayItem) => void;
  /** Dragged by this many minutes (snapped to 15). */
  onMove: (item: DayItem, minutes: number) => void;
}

/** Proportional hour grid: blocks pinned to their minute, past dimmed, a NOW line. */
export function TimelineView({
  day,
  tz,
  now,
  hourPx,
  categories,
  emptyNote,
  onOpen,
  onComplete,
  onSnooze,
  onMove,
}: TimelineViewProps) {
  const hourColumn = useHour12() ? HOUR_COLUMN.h12 : HOUR_COLUMN.h24;
  const minutes = day.items.map((item) => minuteOfDay(item.at, tz));
  const nowMinute = day.isToday ? minuteOfDay(now, tz) : null;
  const [first, last] = hourRange(minutes, nowMinute);
  const height = (last - first) * hourPx + 8;
  const placed = new Map(
    layoutBlocks(
      day.items.map((item, i) => ({ id: item.task.id, minute: minutes[i] ?? 0 })),
      first,
      hourPx,
      { full: Math.max(44, Math.round(hourPx * 0.87)), min: 28, gap: 3 },
    ).map((block) => [block.id, block]),
  );
  const nowTop = nowMinute === null ? null : ((nowMinute - first * 60) / 60) * hourPx;
  const pastHeight = day.isPast ? height : (nowTop ?? 0);

  return (
    <div className="relative mx-3 overflow-hidden rounded-2xl border border-rule bg-surface" style={{ height }}>
      {pastHeight > 0 ? (
        <div
          className="absolute inset-x-0 top-0 bg-elapsed opacity-70"
          style={{ height: pastHeight }}
          aria-hidden="true"
        />
      ) : null}
      {Array.from({ length: last - first }, (_, i) => (
        <div
          key={first + i}
          className="tnum absolute inset-x-0 border-t border-rule pl-2.5 pt-0.5 text-[11px] font-extrabold text-muted first:border-t-0"
          style={{ top: i * hourPx }}
          aria-hidden="true"
        >
          {/* The NOW pill takes the label's place when it sits on it. */}
          {nowTop !== null && Math.abs(nowTop - i * hourPx - 8) < 14 ? null : formatHour(first + i)}
        </div>
      ))}

      {day.items.map((item) => {
        const block = placed.get(item.task.id);
        if (!block) return null;
        return (
          <Block
            key={item.task.id}
            item={item}
            tz={tz}
            now={now}
            category={item.task.categoryId ? categories.get(item.task.categoryId) : undefined}
            compact={block.height < 44}
            style={{
              top: block.top + 2,
              height: block.height,
              left: `calc(${hourColumn}px + (100% - ${hourColumn + 8}px) * ${block.column / block.columns})`,
              width: `calc((100% - ${hourColumn + 8}px) / ${block.columns} - 4px)`,
            }}
            narrow={block.columns > 1}
            onOpen={() => onOpen(item)}
            onComplete={() => onComplete(item)}
            onSnooze={() => onSnooze(item)}
            onMove={(minutes) => onMove(item, minutes)}
            hourPx={hourPx}
          />
        );
      })}

      {nowTop !== null ? (
        // Under the blocks (z-3); its time pill sits in the hour column, which blocks never cover.
        <div
          className="pointer-events-none absolute inset-x-0 z-[2] border-t-2 border-now"
          style={{ top: nowTop }}
          data-now
        >
          <span className="tnum absolute -top-[10px] left-2 rounded-md bg-now px-1.5 py-0.5 text-[10px] font-extrabold text-on-status">
            {formatTime(now, tz)}
          </span>
          {emptyNote ? (
            <p className="absolute right-3 top-3 text-[13px] font-bold text-muted" style={{ left: hourColumn + 8 }}>
              {emptyNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface BlockProps {
  item: DayItem;
  tz: string;
  now: Date;
  hourPx: number;
  category: Category | undefined;
  style: React.CSSProperties;
  narrow: boolean;
  /** One line: title and time side by side. */
  compact: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onMove: (minutes: number) => void;
}

const SWIPE_DONE = 72;

/** A reminder on the grid. Tap opens it, swipe right marks it done, hold and drag moves it. */
function Block({
  item,
  tz,
  now,
  hourPx,
  category,
  style,
  narrow,
  compact,
  onOpen,
  onComplete,
  onSnooze,
  onMove,
}: BlockProps) {
  const { task, state, at } = item;
  const haptic = useHapticFeedback();
  const baseMinute = minuteOfDay(at, tz);
  const gesture = useBlockGesture({
    enabled: state !== 'done',
    onDragStart: () => haptic.impact('medium'),
    onSwipe: (dx) => {
      if (dx >= SWIPE_DONE) onComplete();
    },
    onDrop: (dy) => {
      const minutes = snapMove(baseMinute, dy, hourPx);
      if (minutes !== 0) onMove(minutes);
    },
  });
  const { dx, dy } = gesture.offset;
  const moveBy = gesture.dragging ? snapMove(baseMinute, dy, hourPx) : 0;

  const meta = [
    formatTime(at, tz),
    state === 'done'
      ? task.completedAt
        ? `done ${formatTime(task.completedAt, tz)}`
        : 'done'
      : state === 'overdue'
        ? relativeToNow(at, now)
        : at.getTime() - now.getTime() < 3 * 3600_000
          ? relativeToNow(at, now)
          : null,
    narrow ? null : (category?.name ?? null),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      data-block
      aria-label={`${task.description}, ${meta}`}
      onClick={() => {
        if (!gesture.takeSwallowedClick()) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
      {...gesture.handlers}
      className={cx(
        'absolute cursor-pointer touch-pan-y select-none overflow-hidden rounded-lg border-l-[3px] pl-2.5 pr-2 text-left [-webkit-touch-callout:none]',
        compact ? 'flex items-center gap-2' : 'py-1.5',
        state === 'overdue' && 'border-danger bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-surface))]',
        state === 'later' && 'border-accent bg-accent-soft',
        state === 'done' && 'border-ok bg-accent-soft opacity-55',
        gesture.dragging ? 'z-10 shadow-[0_10px_24px_rgb(16_24_40/0.22)] ring-2 ring-accent' : 'z-[3]',
        dx === 0 && !gesture.dragging && 'transition-transform',
      )}
      style={{
        ...style,
        transform: dx ? `translateX(${dx}px)` : moveBy ? `translateY(${(moveBy / 60) * hourPx}px)` : undefined,
      }}
    >
      {dx > 0 ? (
        <span
          className={cx(
            'absolute inset-y-0 left-0 flex items-center pl-2 text-[11px] font-extrabold',
            dx >= SWIPE_DONE ? 'text-ok' : 'text-muted',
          )}
          style={{ transform: `translateX(-${dx}px)` }}
        >
          ✓ Done
        </span>
      ) : null}
      <p
        className={cx(
          'truncate text-[13.5px] font-extrabold leading-tight text-text',
          state === 'done' && 'line-through',
          compact ? 'min-w-0 flex-1' : !narrow && state === 'overdue' && 'pr-9',
        )}
      >
        {task.priority === 'high' && state !== 'done' ? (
          <Flag size={11} aria-label="High priority" className="mr-1 inline -translate-y-px fill-danger text-danger" />
        ) : null}
        {task.description}
      </p>
      <p
        className={cx(
          'tnum truncate text-[11px] font-bold',
          gesture.dragging ? 'text-accent' : state === 'overdue' ? 'text-danger' : 'text-muted',
          compact ? cx('shrink-0', !narrow && state === 'overdue' && 'pr-10') : 'mt-0.5',
        )}
      >
        {gesture.dragging
          ? `→ ${formatTime(new Date(at.getTime() + moveBy * 60_000), tz)}`
          : compact
            ? formatTime(at, tz)
            : meta}
      </p>
      {state === 'overdue' && !narrow && !gesture.dragging ? (
        <button
          type="button"
          aria-label="Snooze one hour"
          onClick={(event) => {
            event.stopPropagation();
            onSnooze();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className={cx(
            'absolute right-0 top-0 flex w-12 justify-end pr-2',
            compact ? 'h-full items-center' : 'h-11 items-start pt-1.5',
          )}
        >
          <span className="rounded-md border border-danger px-1.5 py-0.5 text-[11px] font-extrabold text-danger">
            +1h
          </span>
        </button>
      ) : null}
    </div>
  );
}
