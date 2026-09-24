import { CalendarDays, CalendarRange, CloudOff, Search, Settings2 } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCategoryMap } from '@/features/categories';
import { useMe } from '@/features/profile';
import { useTaskActions, useTasks } from '@/features/reminders';
import { useSettings } from '@/features/settings';
import {
  buildDay,
  buildWeek,
  dayKey,
  dayStart,
  greeting,
  ListView,
  OverdueSection,
  shiftWeek,
  TimelineView,
  useTodayView,
  WeekStrip,
  type DayItem,
  type DayModel,
} from '@/features/today';
import type { Task } from '@/shared/api';
import { formatInTz, formatTime, relativeToNow, useUserTimezone } from '@/shared/lib/dates';
import { useMainButton } from '@/shared/lib/telegram';
import { savedScroll } from '@/shared/lib/scrollMemory';
import { useNow } from '@/shared/lib/useNow';
import { useRefreshScreen } from '@/shared/lib/useRefreshScreen';
import { Button, Empty, FieldRow, Group, IconButton, Screen, Segmented, SkeletonRows } from '@/shared/ui';

const DONE_VARS = { view: 'done', limit: 100 } as const;

export function TodayPage() {
  const navigate = useNavigate();
  const tz = useUserTimezone();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const todayKey = dayKey(now, tz);
  const requested = params.get('day');
  const selected = requested && dayStart(requested, tz) ? requested : todayKey;

  const pending = useTasks();
  const completed = useTasks(DONE_VARS);
  const categories = useCategoryMap();
  const settings = useSettings();
  const me = useMe();
  const [view, setView] = useTodayView();
  const actions = useTaskActions();
  const screen = useRef<HTMLElement>(null);
  const refresh = useRefreshScreen();

  const day = useMemo(
    () => buildDay(pending.data ?? [], completed.data ?? [], selected, tz, now),
    [pending.data, completed.data, selected, tz, now],
  );
  const week = useMemo(
    () => buildWeek(pending.data ?? [], completed.data ?? [], selected, tz, now, settings.data?.weekStartsOn ?? 1),
    [pending.data, completed.data, selected, tz, now, settings.data?.weekStartsOn],
  );

  const selectDay = (key: string) => setParams(key === todayKey ? {} : { day: key }, { replace: true });

  useMainButton({
    text: 'New reminder',
    onClick: () => navigate(selected === todayKey ? '/create' : `/create?day=${selected}`),
  });

  // Open with now a third of the way down (Timeline), or at the top (List);
  // coming Back keeps the position Screen restored.
  const loaded = pending.isSuccess;
  const { key } = useLocation();
  // The view + day whose position came back with Back; left alone until
  // either changes (checked, not consumed, so re-runs skip it too).
  const restoredFor = useRef(savedScroll(key) !== undefined ? `${view}|${selected}` : null);
  useLayoutEffect(() => {
    const main = screen.current;
    if (!main || !loaded) return;
    if (restoredFor.current === `${view}|${selected}`) return;
    restoredFor.current = null;
    if (view === 'list') {
      main.scrollTo({ top: 0 });
      return;
    }
    const target = main.querySelector<HTMLElement>('[data-now]') ?? main.querySelector<HTMLElement>('[data-block]');
    if (!target) {
      main.scrollTo({ top: 0 });
      return;
    }
    // A third of the way down the part of the screen under the pinned header.
    const pinned = main.querySelector<HTMLElement>('[data-pinned]')?.offsetHeight ?? 0;
    const offset = target.getBoundingClientRect().top - main.getBoundingClientRect().top;
    main.scrollTo({ top: Math.max(0, main.scrollTop + offset - pinned - (main.clientHeight - pinned) / 3) });
    // Only on arrival and when the day or view changes, not on every tick.
  }, [loaded, view, selected]);

  const emptyNote = day.isToday && day.later.length === 0 ? nothingLeft(day, tz) : null;
  const open = (task: Task) => navigate(`/tasks/${task.id}`);
  const toggle = (task: Task, done: boolean, occurrence?: boolean) =>
    occurrence ? actions.doneOccurrence(task) : done ? actions.reopen(task) : actions.complete(task);

  return (
    <Screen back={false} ref={screen} onRefresh={refresh}>
      {/* Pinned: the day stays in view while the grid scrolls under it. */}
      <div className="sticky top-0 z-10 bg-bg" data-pinned>
        <header className="flex items-center justify-between gap-2 pb-2 pl-4 pr-2 pt-2">
          <div className="min-w-0">
            {/* Plan 4.4 #1: greeting + date. The hour is read in the profile zone. */}
            <p className="truncate text-[12.5px] font-bold text-muted" data-greeting>
              {/* The name does not fit beside the controls on a 320px phone. */}
              <span className="min-[360px]:hidden">{greeting(now, tz)}</span>
              <span className="hidden min-[360px]:inline">{greeting(now, tz, me.data?.firstName)}</span>
            </p>
            <h1 className="flex min-w-0 items-baseline gap-1.5 text-[21px] font-extrabold leading-tight tracking-[-0.02em]">
              {/* "September" + the day does not fit next to the controls on a 320px phone. */}
              <span className="min-[360px]:hidden">{formatInTz(day.start, tz, 'MMM')}</span>
              <span className="hidden truncate min-[360px]:inline">{formatInTz(day.start, tz, 'MMMM')}</span>
              <span className="shrink-0 text-[13.5px] font-bold text-muted">{formatInTz(day.start, tz, 'EEE d')}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton label="Search" onClick={() => navigate('/search')}>
              <Search size={19} />
            </IconButton>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'timeline', label: 'Timeline' },
                { value: 'list', label: 'List' },
              ]}
            />
          </div>
        </header>

        <WeekStrip
          days={week}
          selected={selected}
          today={todayKey}
          tz={tz}
          onSelect={selectDay}
          onShiftWeek={(weeks) => selectDay(shiftWeek(selected, weeks, tz))}
        />

        {loaded ? (
          <Summary day={day} now={now} onCatchUp={() => navigate('/catchup')} onToday={() => selectDay(todayKey)} />
        ) : null}
      </div>

      {pending.isPending ? (
        <SkeletonRows count={4} />
      ) : pending.isError ? (
        <Empty
          icon={<CloudOff size={20} />}
          title="Couldn't load your reminders"
          body="Check the connection and try again."
          action={
            <Button variant="primary" onClick={() => void pending.refetch()}>
              Try again
            </Button>
          }
        />
      ) : view === 'timeline' ? (
        <>
          <OverdueSection
            day={day}
            earlierOnly
            tz={tz}
            now={now}
            categories={categories}
            onOpen={open}
            onToggle={toggle}
            onSnooze={(task) => actions.delay(task, 60)}
            onCatchUp={() => navigate('/catchup')}
          />
          {day.earlier.length > 0 ? <div className="h-3" /> : null}
          <TimelineView
            day={day}
            tz={tz}
            now={now}
            hourPx={60}
            categories={categories}
            emptyNote={emptyNote}
            onOpen={(item: DayItem) => open(item.task)}
            onComplete={(item: DayItem) => actions.complete(item.task)}
            onSnooze={(item: DayItem) => actions.delay(item.task, 60)}
            onMove={(item: DayItem, minutes: number) =>
              actions.moveTo(item.task, new Date(item.at.getTime() + minutes * 60_000))
            }
          />
          {!day.isToday && day.items.length === 0 ? (
            <p className="px-4 pt-3 text-center text-[13.5px] font-semibold text-muted">
              <CalendarDays size={14} className="mr-1 inline -translate-y-px" />
              Nothing planned for this day.
            </p>
          ) : null}
        </>
      ) : (
        <ListView
          day={day}
          tz={tz}
          now={now}
          categories={categories}
          emptyNote={emptyNote}
          onOpen={open}
          onToggle={toggle}
          onSnooze={(task) => actions.delay(task, 60)}
          onCatchUp={() => navigate('/catchup')}
          onWeek={() => navigate('/week')}
        />
      )}

      {loaded ? (
        <Group className="mt-6">
          <FieldRow
            icon={<CalendarRange size={16} />}
            label="Week & Inbox"
            value={day.inboxCount ? `${day.inboxCount} undated` : undefined}
            onClick={() => navigate('/week')}
          />
          <FieldRow
            icon={<Settings2 size={16} />}
            iconTone="warn"
            label="Settings"
            onClick={() => navigate('/settings')}
          />
        </Group>
      ) : null}
    </Screen>
  );
}

/** "2 overdue · 3 ahead · 2 done · next in 43 min" */
function Summary({
  day,
  now,
  onCatchUp,
  onToday,
}: {
  day: DayModel;
  now: Date;
  onCatchUp: () => void;
  onToday: () => void;
}) {
  const overdue = day.earlier.length + day.overdue.length;
  const next = day.next?.nextFireAt ?? day.next?.scheduledAt ?? null;
  return (
    <div className="flex items-center gap-3.5 px-4 pb-2.5 text-[12.5px] font-bold text-muted">
      {overdue > 0 ? (
        <button type="button" onClick={onCatchUp} className="-my-3 min-h-11 font-extrabold text-danger">
          {overdue} overdue
        </button>
      ) : null}
      <span>
        {day.later.length} {day.isToday ? 'ahead' : 'planned'}
      </span>
      {day.done.length > 0 ? <span className="text-ok">{day.done.length} done</span> : null}
      {next ? <span className="tnum ml-auto">next {relativeToNow(next, now)}</span> : null}
      {!day.isToday ? (
        <button type="button" onClick={onToday} className="-my-3 ml-auto min-h-11 font-extrabold text-accent">
          Back to today
        </button>
      ) : null}
    </div>
  );
}

function nothingLeft(day: DayModel, tz: string): string {
  const first = day.tomorrow[0];
  const at = first ? (first.nextFireAt ?? first.scheduledAt) : null;
  return at ? `Nothing left today. Tomorrow starts at ${formatTime(at, tz)}.` : 'Nothing left today.';
}
