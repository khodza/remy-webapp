import { Flag, Forward, Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import { CategoryPill } from '@/features/categories';
import type { Category, Task } from '@/shared/api';
import { CheckCircle, cx, Pill } from '@/shared/ui';
import { recurrenceLabel } from '../lib/recurrence';

export type RowTone = 'overdue' | 'later' | 'done' | 'plain';

interface TaskRowProps {
  task: Task;
  tz: string;
  tone: RowTone;
  /** Time column: "11:00" (or a day for other lists). */
  time: ReactNode;
  /** Under the time: "3 h 47 m", "in 43 m". */
  timeSub?: ReactNode;
  category?: Category | undefined;
  onOpen: () => void;
  onToggle: () => void;
  /** Overdue rows get a "+1h" ghost button. */
  onSnooze?: () => void;
}

/** One reminder in a Group: time column, title and meta, actions. */
export function TaskRow({ task, tz, tone, time, timeSub, category, onOpen, onToggle, onSnooze }: TaskRowProps) {
  const done = tone === 'done';
  const repeat = recurrenceLabel(task.recurrence, tz);
  const meta: ReactNode[] = [];
  if (category) meta.push(<CategoryPill key="c" category={category} />);
  if (repeat) {
    meta.push(
      <Pill key="r">
        <Repeat size={11} aria-hidden="true" /> {repeat}
      </Pill>,
    );
  }
  if (!done && task.snoozeCount >= 4) meta.push(<Pill key="s" tone="warn">snoozed ×{task.snoozeCount}</Pill>);
  if (task.source.type === 'forward') {
    meta.push(
      <Pill key="f">
        <Forward size={11} aria-hidden="true" /> forwarded
      </Pill>,
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
      className="grid min-h-14 cursor-pointer grid-cols-[var(--time-col)_minmax(0,1fr)_auto] items-center gap-2.5 py-2 pl-3.5 pr-3 transition active:bg-past"
    >
      <div className="tnum leading-tight">
        <span className={cx('block text-[13px] font-extrabold', tone === 'overdue' ? 'text-danger' : 'text-muted')}>{time}</span>
        {timeSub ? <span className={cx('block text-[10px] font-bold', tone === 'overdue' ? 'text-danger' : 'text-accent')}>{timeSub}</span> : null}
      </div>
      <div className="min-w-0">
        <p className={cx('line-clamp-2 text-[14.5px] font-extrabold leading-tight', done ? 'text-muted line-through' : 'text-text')}>
          {task.priority === 'high' && !done ? <Flag size={12} aria-label="High priority" className="mr-1 inline -translate-y-px fill-danger text-danger" /> : null}
          {task.description}
        </p>
        {meta.length > 0 && !done ? <div className="mt-1 flex min-w-0 flex-wrap gap-1">{meta}</div> : null}
      </div>
      <div className="flex items-center gap-2.5">
        {onSnooze && !done ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSnooze();
            }}
            aria-label="Snooze one hour"
            className="-my-2 flex min-h-11 min-w-11 items-center justify-center"
          >
            <span className="rounded-md border border-danger px-1.5 py-0.5 text-[11px] font-extrabold text-danger">+1h</span>
          </button>
        ) : null}
        <CheckCircle done={done} onToggle={onToggle} label={done ? 'Mark as not done' : 'Mark as done'} tone={tone === 'overdue' ? 'danger' : 'default'} />
      </div>
    </div>
  );
}
