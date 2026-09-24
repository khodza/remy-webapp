import { CloudOff, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryMap } from '@/features/categories';
import { listTitle } from '@/features/lists';
import { SEARCH_LIMIT, TaskRow, useSearchTasks, useTaskActions } from '@/features/reminders';
import { dueAt, isAllDay, isLate } from '@/features/today';
import type { Task } from '@/shared/api';
import { formatInTz, formatTime, useUserTimezone } from '@/shared/lib/dates';
import { useNow } from '@/shared/lib/useNow';
import { Button, Empty, Group, Screen, SectionHeader } from '@/shared/ui';

/**
 * Server search (GET /tasks?q=): every word in the title, notes or list
 * name, pending and completed, never deleted. Debounced; a superseded
 * request is cancelled; the last result stays on screen while typing.
 */
export function SearchPage() {
  const navigate = useNavigate();
  const tz = useUserTimezone();
  const now = useNow();
  const categories = useCategoryMap();
  const actions = useTaskActions();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const search = useSearchTasks(query);
  const groups = useMemo(() => {
    const tasks = search.data ?? [];
    const byDue = (a: Task, b: Task) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0);
    const open = tasks.filter((t) => t.status === 'pending');
    return {
      overdue: open.filter((t) => isLate(t, now, tz)).sort(byDue),
      upcoming: open.filter((t) => dueAt(t) !== null && !isLate(t, now, tz)).sort(byDue),
      inbox: open.filter((t) => dueAt(t) === null),
      done: tasks.filter((t) => t.status === 'completed'),
    };
  }, [search.data, now, tz]);
  const total = groups.overdue.length + groups.upcoming.length + groups.inbox.length + groups.done.length;
  const typing = query.trim().length > 0 && (search.debounced !== query.trim() || search.isFetching);

  const rows = (tasks: Task[], tone: 'overdue' | 'later' | 'done') =>
    tasks.map((task) => {
      const at = tone === 'done' ? (task.completedAt ?? dueAt(task)) : dueAt(task);
      return (
        <TaskRow
          key={task.id}
          task={task}
          tz={tz}
          tone={tone}
          time={at ? formatInTz(at, tz, 'd MMM') : '—'}
          timeSub={
            at
              ? tone !== 'done' && isAllDay(task)
                ? 'all day'
                : formatTime(at, tz)
              : task.list
                ? listTitle(task.list)
                : 'Inbox'
          }
          category={task.categoryId ? categories.get(task.categoryId) : undefined}
          onOpen={() => navigate(`/tasks/${task.id}`)}
          onToggle={() => (tone === 'done' ? actions.reopen(task) : actions.complete(task))}
        />
      );
    });

  return (
    <Screen>
      <div className="sticky top-0 z-10 bg-bg px-3 pb-2 pt-3">
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-rule bg-surface px-3">
          <Search size={17} className={typing ? 'shrink-0 animate-pulse text-accent' : 'shrink-0 text-muted'} />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reminders"
            aria-label="Search reminders"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-text outline-none placeholder:font-semibold placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQuery('')}
              className="-mr-2 flex h-11 w-11 items-center justify-center text-muted"
            >
              <X size={17} />
            </button>
          ) : null}
        </label>
      </div>

      {query.trim().length === 0 ? (
        <p className="px-4 pt-2 text-[13.5px] font-semibold text-muted">
          Titles, notes and list names, open and done. Every word has to match.
        </p>
      ) : search.isError ? (
        <Empty
          icon={<CloudOff size={20} />}
          title="Couldn't search"
          body="Check the connection and try again."
          action={
            <Button variant="primary" onClick={() => void search.refetch()}>
              Try again
            </Button>
          }
        />
      ) : search.data === undefined ? (
        <p className="px-4 pt-2 text-[13.5px] font-semibold text-muted">Searching…</p>
      ) : total === 0 ? (
        <p className="px-4 pt-2 text-[13.5px] font-semibold text-muted" aria-live="polite">
          Nothing matches “{search.debounced}”.
        </p>
      ) : (
        <>
          {groups.overdue.length ? (
            <>
              <SectionHeader label={`Overdue · ${groups.overdue.length}`} />
              <Group>{rows(groups.overdue, 'overdue')}</Group>
            </>
          ) : null}
          {groups.upcoming.length ? (
            <>
              <SectionHeader label={`Upcoming · ${groups.upcoming.length}`} />
              <Group>{rows(groups.upcoming, 'later')}</Group>
            </>
          ) : null}
          {groups.inbox.length ? (
            <>
              <SectionHeader label={`Inbox · ${groups.inbox.length}`} />
              <Group>{rows(groups.inbox, 'later')}</Group>
            </>
          ) : null}
          {groups.done.length ? (
            <>
              <SectionHeader label={`Done · ${groups.done.length}`} />
              <Group>{rows(groups.done, 'done')}</Group>
            </>
          ) : null}
          {total >= SEARCH_LIMIT ? (
            <p className="px-4 pt-3 text-[12.5px] font-semibold text-muted">
              Only the first {SEARCH_LIMIT} matches are shown. Add a word to narrow it down.
            </p>
          ) : null}
        </>
      )}
    </Screen>
  );
}
