import {
  Bell,
  CalendarClock,
  CircleAlert,
  CloudOff,
  Flag,
  Forward,
  Mic,
  MessageSquareText,
  Repeat,
  SkipForward,
  Tag,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategories } from '@/features/categories';
import {
  CategorySheet,
  describeDue,
  leadLabel,
  LeadSheet,
  PRIORITY_LABEL,
  PrioritySheet,
  recurrenceLabel,
  RepeatSheet,
  SnoozeChips,
  useDeferredDelete,
  useTask,
  useTaskActions,
  useUpdateTask,
  WhenSheet,
} from '@/features/reminders';
import { dayKey, LoadStrip, minuteOfDay, useDayTicks } from '@/features/today';
import { ApiError, type Task } from '@/shared/api';
import type { TaskPatch } from '@/shared/api/endpoints';
import { formatDateTime, formatInTz, formatTime, relativeToNow, useUserTimezone } from '@/shared/lib/dates';
import { useGoBack, useMainButton } from '@/shared/lib/telegram';
import { useAutosave } from '@/shared/lib/useAutosave';
import { useNow } from '@/shared/lib/useNow';
import { AutoTextarea, Button, Empty, FieldRow, Group, Screen, SectionHeader, SkeletonRows, toast } from '@/shared/ui';

type SheetName = 'when' | 'lead' | 'repeat' | 'category' | 'priority' | null;

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const task = useTask(id);
  return (
    <Screen>
      {task.data ? (
        <Detail key={task.data.id} task={task.data} />
      ) : task.isPending ? (
        <div className="pt-4">
          <SkeletonRows count={4} />
        </div>
      ) : task.error instanceof ApiError && task.error.status === 404 ? (
        <div className="pt-6">
          <Empty
            icon={<CircleAlert size={20} />}
            title="Reminder not found"
            body="It may have been deleted in the chat."
          />
        </div>
      ) : (
        // Offline or a server error is not "deleted": say so and offer a retry.
        <div className="pt-6">
          <Empty
            icon={<CloudOff size={20} />}
            title="Couldn't load this reminder"
            body="Check your connection and try again."
            action={
              <Button variant="primary" onClick={() => void task.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      )}
    </Screen>
  );
}

function Detail({ task }: { task: Task }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const tz = useUserTimezone();
  const now = useNow();
  const update = useUpdateTask();
  const actions = useTaskActions();
  const deleteLater = useDeferredDelete();
  const categories = useCategories();
  const [sheet, setSheet] = useState<SheetName>(null);
  const close = () => setSheet(null);

  const done = task.status === 'completed';
  const due = task.nextFireAt ?? task.scheduledAt;
  const overdue = !done && due !== null && due.getTime() < now.getTime();
  const category = categories.data?.find((c) => c.id === task.categoryId);
  const ticks = useDayTicks(due, tz, now, task);

  const save = (patch: TaskPatch, message?: string) =>
    update.mutate(
      { id: task.id, patch },
      {
        onSuccess: () => (message ? toast({ message }) : undefined),
        onError: () => toast({ message: "Couldn't save. Try again.", tone: 'danger' }),
      },
    );

  const title = useAutosave(task.description, (value) => {
    const next = value.trim();
    if (next && next !== task.description) save({ description: next });
    else title.setValue(task.description);
  });
  const notes = useAutosave(task.notes ?? '', (value) => {
    const next = value.trim();
    if (next !== (task.notes ?? '')) save({ notes: next || null });
  });

  useMainButton(
    done
      ? { text: 'Reopen', onClick: () => actions.reopen(task) }
      : {
          text: 'Mark as done',
          variant: 'ok',
          onClick: () => {
            title.commit();
            notes.commit();
            actions.complete(task);
            goBack();
          },
        },
  );

  const status = done ? (
    <span className="text-ok">Done{task.completedAt ? ` · ${describeDue(task.completedAt, tz, now)}` : ''}</span>
  ) : due === null ? (
    <span>Inbox · no date</span>
  ) : (
    <span className={overdue ? 'text-danger' : undefined}>
      {describeDue(due, tz, now)} · {relativeToNow(due, now)}
      {task.snoozedUntil && task.scheduledAt ? ` · series ${formatTime(task.scheduledAt, tz)}` : ''}
    </span>
  );

  return (
    <>
      <div className="px-4 pb-3 pt-3">
        <AutoTextarea
          aria-label="Title"
          value={title.value}
          disabled={done}
          onChange={(event) => title.setValue(event.target.value.replace(/\n/g, ' '))}
          onBlur={title.commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="block w-full resize-none overflow-hidden bg-transparent text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-text outline-none disabled:text-muted disabled:line-through"
        />
        <p className="tnum mt-1 text-[13.5px] font-bold text-muted">{status}</p>
      </div>

      {due ? (
        <LoadStrip
          ticks={ticks}
          highlight={task.id}
          nowMinute={dayKey(due, tz) === dayKey(now, tz) ? minuteOfDay(now, tz) : null}
          label={
            dayKey(due, tz) === dayKey(now, tz)
              ? `${formatInTz(due, tz, 'EEE d')} · now ${formatTime(now, tz)}`
              : formatInTz(due, tz, 'EEE d MMM')
          }
        />
      ) : null}

      <SectionHeader label="Details" />
      <Group>
        <FieldRow
          icon={<CalendarClock size={16} />}
          label="When"
          value={due ? formatDateTime(task.scheduledAt ?? due, tz) : 'No date'}
          {...(done ? {} : { onClick: () => setSheet('when') })}
        />
        {task.scheduledAt ? (
          <FieldRow
            icon={<Bell size={16} />}
            label="Remind"
            value={leadLabel(task.leadMinutes)}
            {...(done ? {} : { onClick: () => setSheet('lead') })}
          />
        ) : null}
        <FieldRow
          icon={<Repeat size={16} />}
          iconTone="warn"
          label="Repeat"
          value={task.scheduledAt ? (recurrenceLabel(task.recurrence, tz) ?? 'Never') : 'Needs a date'}
          {...(done || !task.scheduledAt ? {} : { onClick: () => setSheet('repeat') })}
        />
        <FieldRow
          icon={<Tag size={16} />}
          iconTone="ok"
          label="Category"
          value={
            category ? (
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full" style={{ background: category.color }} />
                {category.name}
              </span>
            ) : (
              'None'
            )
          }
          {...(done ? {} : { onClick: () => setSheet('category') })}
        />
        <FieldRow
          icon={<Flag size={16} />}
          iconTone="danger"
          label="Priority"
          value={PRIORITY_LABEL[task.priority]}
          {...(done ? {} : { onClick: () => setSheet('priority') })}
        />
      </Group>

      <SectionHeader label="Notes" />
      <Group>
        <AutoTextarea
          aria-label="Notes"
          value={notes.value}
          placeholder="Add a note"
          disabled={done}
          onChange={(event) => notes.setValue(event.target.value)}
          onBlur={notes.commit}
          className="block min-h-[76px] w-full overflow-hidden resize-none bg-transparent px-3.5 py-3 text-[14.5px] font-semibold leading-snug text-text outline-none placeholder:text-faint"
        />
      </Group>

      {!done && due && due.getTime() < now.getTime() + 24 * 3600_000 ? (
        <>
          <SectionHeader label="Snooze" />
          <SnoozeChips due={due} now={now} onPick={(option) => actions.snooze(task, option)} />
        </>
      ) : null}

      <Source task={task} />

      <Group className="mt-5">
        {!done && task.recurrence ? (
          <FieldRow
            icon={<SkipForward size={16} />}
            iconTone="warn"
            label="Skip this time"
            hint="On to the next one, without a Done"
            onClick={() => actions.skip(task)}
          />
        ) : null}
        <FieldRow
          icon={<Trash2 size={16} />}
          iconTone="danger"
          label={done ? 'Delete' : 'Delete reminder'}
          danger
          onClick={() => {
            deleteLater(task);
            goBack();
          }}
        />
      </Group>
      <p className="tnum px-4 pt-3 text-center text-[12px] font-semibold text-faint">{history(task, tz, now)}</p>

      <WhenSheet
        open={sheet === 'when'}
        onClose={close}
        value={task.scheduledAt}
        now={now}
        allowClear={!task.recurrence}
        {...(task.recurrence ? { note: 'Changes every occurrence. To move just this one, use Snooze.' } : {})}
        onPick={(at) => save({ scheduledAt: at }, at ? `Moved to ${describeDue(at, tz, now)}` : 'Moved to the Inbox')}
      />
      <LeadSheet
        open={sheet === 'lead'}
        onClose={close}
        value={task.leadMinutes}
        onPick={(leadMinutes) => save({ leadMinutes })}
      />
      <RepeatSheet
        open={sheet === 'repeat'}
        onClose={close}
        value={task.recurrence}
        at={task.scheduledAt}
        onPick={(recurrence) => save({ recurrence })}
      />
      <CategorySheet
        open={sheet === 'category'}
        onClose={close}
        categories={categories.data ?? []}
        value={task.categoryId}
        onPick={(categoryId) => save({ categoryId })}
        onManage={() => navigate('/settings/categories')}
      />
      <PrioritySheet
        open={sheet === 'priority'}
        onClose={close}
        value={task.priority}
        onPick={(priority) => save({ priority })}
      />
    </>
  );
}

const SOURCE: Record<Task['source']['type'], { label: string; icon: ReactNode }> = {
  text: { label: 'From your message', icon: <MessageSquareText size={14} /> },
  voice: { label: 'From a voice note', icon: <Mic size={14} /> },
  forward: { label: 'Forwarded message', icon: <Forward size={14} /> },
  miniapp: { label: 'Added in the app', icon: null },
};

/** Where it came from: your words, the transcript, or the forwarded message. */
function Source({ task }: { task: Task }) {
  const { type, originalText, forwardedFrom } = task.source;
  if (!originalText && !forwardedFrom) return null;
  const source = SOURCE[type];
  return (
    <>
      <SectionHeader label="Source" />
      <Group>
        <div className="px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-muted">
            {source.icon}
            {source.label}
            {forwardedFrom ? ` · ${forwardedFrom}` : ''}
          </p>
          {originalText ? (
            <p className="mt-1.5 border-l-2 border-rule pl-2.5 text-[14px] font-semibold leading-snug text-text">
              “{originalText}”
            </p>
          ) : null}
        </div>
      </Group>
    </>
  );
}

/** "created Mon 15 Sep 18:12 by voice · snoozed 5 times · done 2 times" */
function history(task: Task, tz: string, now: Date): string {
  const how = { text: 'in chat', voice: 'by voice', forward: 'from a forward', miniapp: 'in the app' }[
    task.source.type
  ];
  const parts = [`created ${describeDue(task.createdAt, tz, now)} ${how}`];
  if (task.snoozeCount > 0) parts.push(`snoozed ${task.snoozeCount === 1 ? 'once' : `${task.snoozeCount} times`}`);
  if (task.completionsCount > 0)
    parts.push(`done ${task.completionsCount === 1 ? 'once' : `${task.completionsCount} times`}`);
  return parts.join(' · ');
}
