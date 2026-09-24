import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryMap } from '@/features/categories';
import { TaskRow, useTaskActions, useTasks } from '@/features/reminders';
import { dueAt } from '@/features/today';
import type { Category, Task } from '@/shared/api';
import { formatInTz, formatTime, useUserTimezone } from '@/shared/lib/dates';
import { useNow } from '@/shared/lib/useNow';
import { Group, Screen, SectionHeader } from '@/shared/ui';

const DONE_VARS = { view: 'done', limit: 100 } as const;

function haystack(task: Task, category: Category | undefined): string {
  return [task.description, task.notes, task.source.originalText, task.source.forwardedFrom, category?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Everything loaded (pending and recent done), searched on the phone. */
export function SearchPage() {
  const navigate = useNavigate();
  const tz = useUserTimezone();
  const now = useNow();
  const pending = useTasks();
  const done = useTasks(DONE_VARS);
  const categories = useCategoryMap();
  const actions = useTaskActions();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const groups = useMemo(() => {
    const match = (task: Task) => {
      const text = haystack(task, task.categoryId ? categories.get(task.categoryId) : undefined);
      return terms.every((term) => text.includes(term));
    };
    const byDue = (a: Task, b: Task) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0);
    const open = terms.length ? (pending.data ?? []).filter(match) : [];
    return {
      overdue: open.filter((t) => (dueAt(t)?.getTime() ?? Infinity) < now.getTime()).sort(byDue),
      upcoming: open.filter((t) => (dueAt(t)?.getTime() ?? -Infinity) >= now.getTime()).sort(byDue),
      inbox: open.filter((t) => dueAt(t) === null),
      done: terms.length ? (done.data ?? []).filter(match) : [],
    };
  }, [terms, pending.data, done.data, categories, now]);
  const total = groups.overdue.length + groups.upcoming.length + groups.inbox.length + groups.done.length;

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
          timeSub={at ? formatTime(at, tz) : 'Inbox'}
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
          <Search size={17} className="shrink-0 text-muted" />
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

      {terms.length === 0 ? (
        <p className="px-4 pt-2 text-[13.5px] font-semibold text-muted">
          Titles, notes, the words you said to the bot, forwarded-from names and categories.
        </p>
      ) : total === 0 ? (
        <p className="px-4 pt-2 text-[13.5px] font-semibold text-muted">Nothing matches “{query.trim()}”.</p>
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
        </>
      )}
    </Screen>
  );
}
