import { Flag, List, Repeat } from 'lucide-react';
import type { Category, TaskDraft } from '@/shared/api';
import { formatDayShort, isTodayInTz, isTomorrowInTz } from '@/shared/lib/dates';
import { CheckCircle, cx, Group, Pill } from '@/shared/ui';
import { recurrenceLabel } from '../lib/recurrence';
import { describeDue, isDraftPast } from '../lib/when';

interface DraftReviewListProps {
  drafts: TaskDraft[];
  /** Indexes the user unticked. */
  skipped: Set<number>;
  tz: string;
  now: Date;
  categories: Map<string, Category>;
  onToggle: (index: number) => void;
  /** Tap on the time: change it (or give a todo one). */
  onEditTime: (index: number) => void;
}

/** "Today, all day", "Tomorrow", "Wed 24 Sep". */
function describeDay(at: Date, tz: string, now: Date): string {
  if (isTodayInTz(at, tz, now)) return 'Today · all day';
  if (isTomorrowInTz(at, tz, now)) return 'Tomorrow · all day';
  return `${formatDayShort(at, tz)} · all day`;
}

/**
 * Drafts read from text, one row each: tick to keep, tap the time to change
 * it. Shared by Import (a pasted list) and Create (a sentence that held
 * several reminders). A time that already passed turns red and must be
 * changed or left out before anything is added.
 */
export function DraftReviewList({ drafts, skipped, tz, now, categories, onToggle, onEditTime }: DraftReviewListProps) {
  return (
    <Group>
      {drafts.map((draft, i) => {
        const on = !skipped.has(i);
        const repeat = recurrenceLabel(draft.recurrence, tz);
        const category = draft.categoryId ? categories.get(draft.categoryId) : undefined;
        const past = on && isDraftPast(draft, now, tz);
        return (
          <div
            key={i}
            className={cx('flex min-h-row items-center gap-3 py-row-y pl-3.5 pr-2', !on && 'opacity-45')}
            data-draft-row
          >
            <CheckCircle
              done={on}
              label={on ? `Skip ${draft.description}` : `Add ${draft.description}`}
              onToggle={() => onToggle(i)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-extrabold leading-tight">
                {draft.priority === 'high' ? (
                  <Flag
                    size={12}
                    aria-label="High priority"
                    className="mr-1 inline -translate-y-px fill-danger text-danger"
                  />
                ) : null}
                {draft.description}
              </p>
              {draft.notes ? (
                <p className="mt-0.5 truncate text-[12px] font-semibold text-muted">{draft.notes}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-1">
                {repeat ? (
                  <Pill>
                    <Repeat size={11} aria-hidden="true" /> {repeat}
                  </Pill>
                ) : null}
                {category ? <Pill>{category.name}</Pill> : null}
                {draft.list ? (
                  <Pill tone="accent">
                    <List size={11} aria-hidden="true" /> {draft.list}
                  </Pill>
                ) : null}
                {draft.priority === 'low' ? <Pill>low priority</Pill> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditTime(i)}
              aria-label={past ? `${draft.description}: the time has passed, pick another` : undefined}
              className={cx(
                'tnum min-h-11 shrink-0 rounded-xl px-2.5 text-right text-[12.5px] font-extrabold',
                past ? 'text-danger' : draft.scheduledAt ? 'text-accent' : 'text-muted',
              )}
            >
              {draft.scheduledAt
                ? draft.allDay
                  ? describeDay(draft.scheduledAt, tz, now)
                  : describeDue(draft.scheduledAt, tz, now)
                : 'Inbox'}
              {past ? <span className="block text-[11px]">passed · change</span> : null}
            </button>
          </div>
        );
      })}
    </Group>
  );
}
