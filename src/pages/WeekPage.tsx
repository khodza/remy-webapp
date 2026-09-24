import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryMap } from '@/features/categories';
import { describeDue, TaskRow, useTaskActions, useTasks, useUpdateTask, WhenSheet } from '@/features/reminders';
import { useSettings } from '@/features/settings';
import {
  DayDropDock,
  dayKey,
  dueAt,
  LoadStrip,
  minuteOfDay,
  sameTimeOnDay,
  shiftWeek,
  useDayTicks,
  useRowDrag,
  weekDays,
} from '@/features/today';
import type { Task } from '@/shared/api';
import { formatDateTime, formatHour, formatInTz, formatTime, useUserTimezone } from '@/shared/lib/dates';
import { useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import { useNow } from '@/shared/lib/useNow';
import { useRefreshScreen } from '@/shared/lib/useRefreshScreen';
import { cx, Empty, Group, IconButton, Screen, SectionHeader, SkeletonRows, toast } from '@/shared/ui';

/**
 * A calendar week (from the user's week start) of load at a glance, the
 * undated Inbox, then each day's list. Hold a row and drag it onto another
 * day to move it there at the same time.
 */
export function WeekPage() {
  const navigate = useNavigate();
  const tz = useUserTimezone();
  const now = useNow();
  const pending = useTasks();
  const categories = useCategoryMap();
  const actions = useTaskActions();
  const update = useUpdateTask();
  const settings = useSettings();
  const haptic = useHapticFeedback();
  const weekStartsOn = settings.data?.weekStartsOn ?? 1;
  const [offset, setOffset] = useState(0);
  const [scheduling, setScheduling] = useState<Task | null>(null);
  const todayKey = dayKey(now, tz);
  const refresh = useRefreshScreen();

  useMainButton({ text: 'New reminder', onClick: () => navigate('/create') });

  const days = useMemo(
    () => weekDays(shiftWeek(todayKey, offset, tz), tz, weekStartsOn, now),
    [todayKey, offset, tz, weekStartsOn, now],
  );

  const drag = useRowDrag<Task>({
    onStart: () => haptic.impact('medium'),
    onOver: (target) => {
      if (target) haptic.selection();
    },
    onDrop: (task, key) => {
      const due = dueAt(task);
      const at = due ? sameTimeOnDay(due, key, tz) : null;
      if (!due || !at || key === dayKey(due, tz)) return;
      // Same path as the Timeline drag: a one-off gets the new time with
      // Undo, a repeating task moves only this occurrence, the past is refused.
      actions.moveTo(task, at);
    },
  });
  const dragged = drag.drag;
  const draggedDue = dragged ? dueAt(dragged.item) : null;
  const dropAt = draggedDue && dragged?.over ? sameTimeOnDay(draggedDue, dragged.over, tz) : null;

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of pending.data ?? []) {
      const due = dueAt(task);
      if (!due || task.status !== 'pending') continue;
      const key = dayKey(due, tz);
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    for (const list of map.values()) list.sort((a, b) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0));
    return map;
  }, [pending.data, tz]);
  const inbox = (pending.data ?? []).filter((t) => t.status === 'pending' && dueAt(t) === null);
  const first = days[0];
  const last = days[6];

  return (
    <Screen onRefresh={refresh}>
      <header className="flex items-center justify-between pb-1 pl-4 pr-2 pt-3">
        <h1 className="flex items-baseline gap-1.5 text-[21px] font-extrabold tracking-[-0.02em]">
          Week
          {first && last ? (
            <span className="tnum text-[13.5px] font-bold text-muted">
              {formatInTz(first.start, tz, 'd MMM')} – {formatInTz(last.start, tz, 'd MMM')}
            </span>
          ) : null}
        </h1>
        <div className="flex items-center">
          {offset !== 0 ? (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="min-h-11 px-2 text-[13px] font-extrabold text-accent"
            >
              This week
            </button>
          ) : null}
          <IconButton label="Previous week" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label="Next week" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
      </header>

      <SectionHeader
        label={`Load · ${formatHour(6)} → ${formatHour(24)}`}
        right={<span className="font-bold normal-case text-muted">tap a day</span>}
      />
      <Group>
        {days.map((day) => (
          <WeekRow
            key={day.key}
            dropKey={day.key >= todayKey ? day.key : null}
            over={dragged?.over === day.key}
            start={day.start}
            isToday={day.key === todayKey}
            count={byDay.get(day.key)?.length ?? 0}
            tz={tz}
            now={now}
            onOpen={() => navigate(day.key === todayKey ? '/' : `/?day=${day.key}`)}
          />
        ))}
      </Group>

      <SectionHeader label={`Inbox · no date`} right={<span className="tnum text-muted">{inbox.length}</span>} />
      {pending.isPending ? (
        <SkeletonRows count={2} />
      ) : inbox.length > 0 ? (
        <Group>
          {inbox.map((task) => {
            const category = task.categoryId ? categories.get(task.categoryId) : undefined;
            return (
              <div key={task.id} className="flex min-h-row items-center gap-2 py-row-y pl-3.5 pr-2">
                <button
                  type="button"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[14.5px] font-extrabold">{task.description}</span>
                  <span className="block truncate text-[11.5px] font-bold text-muted">
                    {[
                      `added ${formatInTz(task.createdAt, tz, 'EEE d MMM')}`,
                      category?.name,
                      task.source.type === 'forward' ? 'forwarded' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduling(task)}
                  className="min-h-11 shrink-0 rounded-xl px-3 text-[13px] font-extrabold text-accent active:bg-accent-soft"
                >
                  Schedule
                </button>
              </div>
            );
          })}
        </Group>
      ) : (
        <Empty
          icon={<Inbox size={20} />}
          title="Inbox is empty"
          body="Things without a date land here. Tell the bot “someday: buy new headphones”."
        />
      )}

      {days.map((day) => {
        const tasks = byDay.get(day.key);
        if (!tasks?.length) return null;
        return (
          <section
            key={day.key}
            {...(day.key >= todayKey ? { 'data-drop-day': day.key } : {})}
            className={cx('rounded-2xl transition', dragged?.over === day.key && 'bg-accent-soft')}
          >
            <SectionHeader
              label={
                day.key === todayKey
                  ? `Today · ${formatInTz(day.start, tz, 'EEE d')}`
                  : formatInTz(day.start, tz, 'EEE d MMM')
              }
              right={<span className="tnum text-muted">{tasks.length}</span>}
            />
            <Group>
              {tasks.map((task) => {
                const due = dueAt(task) ?? now;
                const late = due.getTime() < now.getTime();
                const lifted = dragged?.item.id === task.id;
                return (
                  <div
                    key={task.id}
                    {...drag.bind(task)}
                    className={cx('touch-pan-y select-none [-webkit-touch-callout:none]', lifted && 'opacity-40')}
                  >
                    <TaskRow
                      task={task}
                      tz={tz}
                      tone={late ? 'overdue' : 'later'}
                      time={formatTime(due, tz)}
                      category={task.categoryId ? categories.get(task.categoryId) : undefined}
                      onOpen={() => navigate(`/tasks/${task.id}`)}
                      onToggle={() => actions.complete(task)}
                      {...(late ? { onSnooze: () => actions.delay(task, 60) } : {})}
                    />
                  </div>
                );
              })}
            </Group>
          </section>
        );
      })}

      {days.some((day) => byDay.get(day.key)?.length) ? (
        <p className="px-4 pt-3 text-[12.5px] font-semibold text-muted">
          Hold a reminder and drag it onto another day to move it there at the same time.
        </p>
      ) : null}

      {dragged && draggedDue ? (
        <>
          <div
            className="tnum pointer-events-none fixed z-40 max-w-[70vw] -translate-x-1/2 -translate-y-[calc(100%+14px)] truncate rounded-xl bg-text px-3 py-2 text-[13px] font-extrabold text-bg shadow-[0_10px_24px_rgb(16_24_40/0.25)]"
            style={{ left: `clamp(35vw, ${dragged.x}px, 65vw)`, top: dragged.y }}
            aria-hidden="true"
          >
            {dragged.item.description}
          </div>
          <DayDropDock
            days={days}
            tz={tz}
            from={dayKey(draggedDue, tz)}
            over={dragged.over}
            closed={(key) => key < todayKey}
            hint={
              dropAt ? `Move to ${formatDateTime(dropAt, tz)}` : `Drop on a day · keeps ${formatTime(draggedDue, tz)}`
            }
          />
        </>
      ) : null}

      <WhenSheet
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        title="Schedule"
        value={null}
        now={now}
        onPick={(at) => {
          const task = scheduling;
          if (!task || !at) return;
          update.mutate(
            { id: task.id, patch: { scheduledAt: at } },
            {
              onSuccess: () => toast({ message: `Scheduled for ${describeDue(at, tz, new Date())}` }),
              onError: () => toast({ message: "Couldn't schedule it. Try again.", tone: 'danger' }),
            },
          );
        }}
      />
    </Screen>
  );
}

interface WeekRowProps {
  /** Accepts a dragged row (days already over do not). */
  dropKey: string | null;
  /** A dragged row is over this day. */
  over: boolean;
  start: Date;
  isToday: boolean;
  count: number;
  tz: string;
  now: Date;
  onOpen: () => void;
}

function WeekRow({ dropKey, over, start, isToday, count, tz, now, onOpen }: WeekRowProps) {
  const ticks = useDayTicks(start, tz, now);
  return (
    <button
      type="button"
      onClick={onOpen}
      {...(dropKey ? { 'data-drop-day': dropKey } : {})}
      className={cx(
        'flex min-h-field w-full items-center gap-3 px-3.5 text-left active:bg-past',
        over && 'bg-accent-soft',
      )}
    >
      <span className="w-11 shrink-0 leading-tight">
        <span className="block text-[14px] font-extrabold">{formatInTz(start, tz, 'EEE')}</span>
        <span className={cx('tnum block text-[10.5px] font-extrabold', isToday ? 'text-accent' : 'text-muted')}>
          {isToday ? 'TODAY' : formatInTz(start, tz, 'd')}
        </span>
      </span>
      <LoadStrip
        compact
        ticks={ticks}
        nowMinute={isToday ? minuteOfDay(now, tz) : null}
        label={formatInTz(start, tz, 'EEEE d MMMM')}
      />
      <span className={cx('tnum w-5 shrink-0 text-right text-[14px] font-extrabold', count === 0 && 'text-faint')}>
        {count}
      </span>
    </button>
  );
}
