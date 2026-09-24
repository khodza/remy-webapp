import { ChevronRight, Inbox } from 'lucide-react';
import { useState } from 'react';
import { TaskRow } from '@/features/reminders';
import type { Category, Task } from '@/shared/api';
import { formatDayShort, formatInTz, formatTime, spanLabel } from '@/shared/lib/dates';
import { Group, SectionHeader } from '@/shared/ui';
import { dueAt, type DayModel } from '../lib/day';

interface RowContext {
  tz: string;
  now: Date;
  categories: Map<string, Category>;
  onOpen: (task: Task) => void;
  /** `occurrence`: a done occurrence of a repeating task (nothing to reopen). */
  onToggle: (task: Task, done: boolean, occurrence?: boolean) => void;
  onSnooze: (task: Task) => void;
}

interface RowOptions {
  /** Show the day in the time column (overdue from an earlier day). */
  withDay?: boolean;
  /** "in 43 m" under the time. */
  isNext?: boolean;
  /** React key when one task appears more than once on the day. */
  key?: string;
  /** A done occurrence of a repeating task. */
  occurrence?: boolean;
}

function renderRow(
  ctx: RowContext,
  task: Task,
  tone: 'overdue' | 'later' | 'done',
  at: Date | null,
  options: RowOptions = {},
) {
  const { tz, now } = ctx;
  let timeSub: string | undefined;
  if (at && tone === 'overdue') timeSub = options.withDay ? formatTime(at, tz) : spanLabel(at, now);
  else if (at && options.isNext) timeSub = `in ${spanLabel(at, now)}`;
  return (
    <TaskRow
      key={options.key ?? task.id}
      task={task}
      tz={tz}
      tone={tone}
      time={at ? (options.withDay ? formatInTz(at, tz, 'EEE d') : formatTime(at, tz)) : '—'}
      timeSub={timeSub}
      category={task.categoryId ? ctx.categories.get(task.categoryId) : undefined}
      onOpen={() => ctx.onOpen(task)}
      onToggle={() => ctx.onToggle(task, tone === 'done', options.occurrence)}
      {...(tone === 'overdue' ? { onSnooze: () => ctx.onSnooze(task) } : {})}
    />
  );
}

interface OverdueSectionProps extends RowContext {
  day: DayModel;
  /** Timeline shows only the earlier days; its grid holds today's. */
  earlierOnly?: boolean;
  onCatchUp: () => void;
}

/** "Overdue · 2   Catch up ↗" and the rows, each with +1h. */
export function OverdueSection({ day, earlierOnly = false, onCatchUp, ...ctx }: OverdueSectionProps) {
  const tasks = earlierOnly ? day.earlier : [...day.earlier, ...day.overdue.map((i) => i.task)];
  if (tasks.length === 0) return null;
  const earlier = new Set(day.earlier.map((t) => t.id));
  return (
    <>
      <SectionHeader
        label={`${earlierOnly ? 'Earlier' : 'Overdue'} · ${tasks.length}`}
        right={
          <button type="button" className="-my-2 min-h-11 px-1" onClick={onCatchUp}>
            Catch up ↗
          </button>
        }
      />
      <Group>
        {tasks.map((task) => renderRow(ctx, task, 'overdue', dueAt(task), { withDay: earlier.has(task.id) }))}
      </Group>
    </>
  );
}

interface ListViewProps extends RowContext {
  day: DayModel;
  emptyNote: string | null;
  onCatchUp: () => void;
  onWeek: () => void;
}

/** The day as groups: Overdue, NOW, Later today, Done, Tomorrow. */
export function ListView({ day, emptyNote, onCatchUp, onWeek, ...ctx }: ListViewProps) {
  const [showDone, setShowDone] = useState(true);
  const { tz, now } = ctx;

  const doneGroup =
    day.done.length > 0 ? (
      <>
        <SectionHeader
          label={`Done · ${day.done.length}`}
          right={
            <button type="button" className="-my-2 min-h-11 px-1" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Hide' : 'Show'}
            </button>
          }
        />
        {showDone ? (
          <Group>
            {day.done.map((item) =>
              renderRow(ctx, item.task, 'done', item.at, { key: item.id, occurrence: item.occurrence }),
            )}
          </Group>
        ) : null}
      </>
    ) : null;

  if (!day.isToday) {
    const open = [...day.overdue, ...day.later];
    return (
      <>
        <SectionHeader label={`${formatDayShort(day.start, tz)} · ${open.length} open`} />
        {open.length > 0 ? (
          <Group>
            {open.map((item) => renderRow(ctx, item.task, item.state === 'overdue' ? 'overdue' : 'later', item.at))}
          </Group>
        ) : (
          <p className="px-4 py-1 text-[13.5px] font-semibold text-muted">Nothing planned for this day.</p>
        )}
        {doneGroup}
      </>
    );
  }

  return (
    <>
      <OverdueSection day={day} onCatchUp={onCatchUp} {...ctx} />

      <div className="grid grid-cols-[auto_1fr] items-center gap-2 px-4 pt-3.5 text-[11px] font-extrabold text-now">
        <span className="tnum">NOW {formatTime(now, tz)}</span>
        <i className="block h-0.5 bg-now" aria-hidden="true" />
      </div>

      <SectionHeader label={`Later today · ${day.later.length}`} />
      {day.later.length > 0 ? (
        <Group>
          {day.later.map((item) =>
            renderRow(ctx, item.task, 'later', item.at, { isNext: item.task.id === day.next?.id }),
          )}
        </Group>
      ) : (
        <p className="px-4 pb-1 text-[13.5px] font-semibold text-muted">{emptyNote}</p>
      )}

      {doneGroup}

      {day.tomorrow.length > 0 ? (
        <>
          <SectionHeader
            label={`Tomorrow · ${formatInTz(day.end, tz, 'EEE d')}`}
            right={
              <button type="button" className="-my-2 min-h-11 px-1" onClick={onWeek}>
                Week ↗
              </button>
            }
          />
          <Group>{day.tomorrow.map((task) => renderRow(ctx, task, 'later', dueAt(task)))}</Group>
        </>
      ) : null}

      {day.inboxCount > 0 ? (
        <Group className="mt-4">
          <button
            type="button"
            onClick={onWeek}
            className="flex min-h-field w-full items-center gap-2.5 px-3.5 text-left active:bg-past"
          >
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent-soft text-accent">
              <Inbox size={16} />
            </span>
            <span className="flex-1 text-[14.5px] font-bold">Inbox</span>
            <span className="tnum text-[13.5px] font-bold text-muted">{day.inboxCount} without a date</span>
            <ChevronRight size={16} className="text-faint" />
          </button>
        </Group>
      ) : null}
    </>
  );
}
