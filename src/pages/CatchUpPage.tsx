import { addDays } from 'date-fns';
import { Check, PartyPopper } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryMap } from '@/features/categories';
import {
  describeDue,
  SnoozeChips,
  useDeferredDelete,
  useSnoozeTask,
  useTaskActions,
  useTasks,
  WhenSheet,
} from '@/features/reminders';
import { dayKey, dueAt, isAllDay, isLate, LoadStrip, minuteOfDay, useDayTicks } from '@/features/today';
import type { Task } from '@/shared/api';
import {
  atTimeInTz,
  formatDayShort,
  formatInTz,
  formatTime,
  inTz,
  relativeToNow,
  useUserTimezone,
} from '@/shared/lib/dates';
import { useMainButton } from '@/shared/lib/telegram';
import { useNow } from '@/shared/lib/useNow';
import { Button, Placeholder, Screen, SkeletonRows, toast } from '@/shared/ui';

/**
 * Overdue triage, one card at a time: snooze, move, delete or done, and
 * the MainButton moves everything left to tomorrow.
 */
export function CatchUpPage() {
  const navigate = useNavigate();
  const tz = useUserTimezone();
  const now = useNow();
  const pending = useTasks();
  const categories = useCategoryMap();
  const actions = useTaskActions();
  const snoozeMutation = useSnoozeTask();
  const deleteLater = useDeferredDelete();
  // Cards handled here leave the stack at once, before the server answers.
  const [handled, setHandled] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);

  const overdue = useMemo(
    () =>
      (pending.data ?? [])
        .filter((t) => t.status === 'pending' && !handled.includes(t.id) && isLate(t, now, tz))
        .sort((a, b) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0)),
    [pending.data, handled, now, tz],
  );
  const card = overdue[0];
  const next = overdue[1];
  const total = handled.length + overdue.length;
  const handle = (task: Task) => setHandled((ids) => [...ids, task.id]);

  const rescheduleAll = () => {
    const tasks = overdue;
    setHandled((ids) => [...ids, ...tasks.map((t) => t.id)]);
    // Same wall-clock time, tomorrow.
    Promise.allSettled(
      tasks.map((task) => {
        const due = dueAt(task) ?? now;
        const local = inTz(due, tz);
        const until = atTimeInTz(addDays(inTz(now, tz), 1), tz, local.getHours(), local.getMinutes());
        return snoozeMutation.mutateAsync({ id: task.id, until });
      }),
    ).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected').length;
      toast(
        failed
          ? { message: `Moved ${tasks.length - failed}; ${failed} failed.`, tone: 'danger' }
          : { message: `Moved ${tasks.length} to tomorrow` },
      );
    });
    navigate('/', { replace: true });
  };

  useMainButton(
    card
      ? {
          text: overdue.length > 1 ? `Reschedule all ${overdue.length} to tomorrow` : 'Move to tomorrow',
          onClick: rescheduleAll,
        }
      : { text: 'Back to Today', onClick: () => navigate('/', { replace: true }) },
  );

  if (pending.isPending) {
    return (
      <Screen>
        <div className="pt-4">
          <SkeletonRows count={2} />
        </div>
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen>
        <Placeholder
          icon={<PartyPopper size={24} />}
          title="All caught up"
          body={handled.length ? `${handled.length} handled. Nothing overdue now.` : 'Nothing is overdue.'}
        />
      </Screen>
    );
  }

  const due = dueAt(card) ?? now;
  const category = card.categoryId ? categories.get(card.categoryId) : undefined;

  return (
    <Screen>
      <div className="flex items-center gap-1 px-4 pt-3" aria-label={`${handled.length + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={`h-1 flex-1 rounded-full ${i <= handled.length ? 'bg-danger' : 'bg-rule'}`} />
        ))}
      </div>
      <div className="flex items-baseline justify-between px-4 pb-3 pt-3">
        <h1 className="text-[21px] font-extrabold tracking-[-0.02em]">Catch up</h1>
        <span className="tnum text-[13px] font-bold text-muted">
          {handled.length + 1} of {total}
        </span>
      </div>

      <article
        key={card.id}
        className="mx-3 rounded-2xl border border-rule bg-surface pb-3.5 pt-4 shadow-[0_10px_30px_rgb(16_24_40/0.10)] [animation:remy-toast-in_.2s_ease-out]"
      >
        <p className="tnum px-4 text-[11px] font-extrabold uppercase tracking-[0.06em] text-danger">
          {isAllDay(card)
            ? `Overdue · ${formatDayShort(due, tz)} · all day`
            : `Overdue · ${describeDue(due, tz, now)} · ${relativeToNow(due, now).replace(' late', '')}`}
        </p>
        <h2 className="px-4 pt-1.5 text-[20px] font-extrabold leading-tight tracking-[-0.01em]">{card.description}</h2>
        {card.source.originalText && card.source.type !== 'miniapp' ? (
          <p className="mx-4 mt-2 border-l-2 border-rule pl-2.5 text-[13.5px] font-semibold leading-snug text-muted">
            {card.source.forwardedFrom ? `From ${card.source.forwardedFrom}: ` : ''}“{card.source.originalText}”
          </p>
        ) : null}
        {card.notes ? (
          <p className="px-4 pt-2 text-[13.5px] font-semibold leading-snug text-text">{card.notes}</p>
        ) : null}
        <p className="px-4 pt-2 text-[12px] font-bold text-muted">
          {[
            category?.name,
            card.priority === 'high' ? 'High priority' : null,
            card.snoozeCount > 0 ? `snoozed ${card.snoozeCount}×` : null,
            `added ${formatInTz(card.createdAt, tz, 'EEE d MMM')}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="pb-3 pt-3.5">
          <CardStrip task={card} due={due} tz={tz} now={now} />
        </div>
        <SnoozeChips
          due={due}
          now={now}
          onPick={(option) => {
            handle(card);
            actions.snooze(card, option);
          }}
        />
        <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2 px-4 pt-2.5">
          <Button
            variant="danger"
            onClick={() => {
              handle(card);
              deleteLater(card);
            }}
          >
            Delete
          </Button>
          <Button onClick={() => setMoving(true)}>Move…</Button>
          <Button
            variant="primary"
            icon={<Check size={16} strokeWidth={3} />}
            onClick={() => {
              handle(card);
              actions.complete(card);
            }}
          >
            Done
          </Button>
        </div>
      </article>

      <div className="flex items-center justify-between px-4 pt-3 text-[12.5px] font-bold text-muted">
        <span className="min-w-0 truncate">
          {next ? `Next: ${next.description} · ${formatTime(dueAt(next) ?? now, tz)}` : 'Last one'}
        </span>
        {card.recurrence ? (
          // Gap 2: a real skip. The series moves on; nothing is marked done.
          <button
            type="button"
            onClick={() => {
              handle(card);
              actions.skip(card);
            }}
            className="-my-3 min-h-11 shrink-0 pl-3 font-extrabold text-accent"
          >
            Skip this time →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handle(card)}
            className="-my-3 min-h-11 shrink-0 pl-3 font-extrabold text-accent"
          >
            Skip →
          </button>
        )}
      </div>

      <WhenSheet
        open={moving}
        onClose={() => setMoving(false)}
        title="Move to"
        value={null}
        now={now}
        onPick={(at) => {
          if (!at) return;
          handle(card);
          actions.snoozeUntil(card, at);
        }}
      />
    </Screen>
  );
}

function CardStrip({ task, due, tz, now }: { task: Task; due: Date; tz: string; now: Date }) {
  const ticks = useDayTicks(due, tz, now, task);
  const today = dayKey(due, tz) === dayKey(now, tz);
  return (
    <LoadStrip
      ticks={ticks}
      highlight={task.id}
      nowMinute={today ? minuteOfDay(now, tz) : null}
      label={today ? 'today' : formatInTz(due, tz, 'EEE d MMM')}
    />
  );
}
