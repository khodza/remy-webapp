import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, Flag, Pencil, Repeat, Sparkles, Tag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  TaskRow,
  useCreateTaskStructured,
  useDeleteTask,
  useTaskActions,
  useTasks,
  VoiceRecordButton,
  WhenSheet,
} from '@/features/reminders';
import { Token } from '@/features/reminders/components/Token';
import { ambiguousTime, similarTasks, stripCategoryTags, suggestCategory } from '@/features/reminders/lib/draft';
import { dayKey, dayStart, LoadStrip, minuteOfDay, useDayTicks } from '@/features/today';
import * as api from '@/shared/api';
import type { Priority, Recurrence } from '@/shared/api';
import { atTimeInTz, formatInTz, formatTime, relativeToNow, useUserTimezone } from '@/shared/lib/dates';
import { useClosingConfirmation, useGoBack, useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useNow } from '@/shared/lib/useNow';
import { AutoTextarea, Button, FieldRow, Group, Screen, SectionHeader, Sheet, toast } from '@/shared/ui';

interface Draft {
  description: string;
  scheduledAt: Date | null;
  recurrence: Recurrence | null;
  categoryId: string | null;
  leadMinutes: number | null;
  priority: Priority;
}

type SheetName = 'title' | 'when' | 'repeat' | 'category' | 'lead' | 'priority' | null;
const MIN_PARSE_LENGTH = 4;
const MAX_LENGTH = 4000;

/**
 * Type a sentence; Remy turns it into tokens (date, time, repeat,
 * category). Tap a token to fix it. Add saves exactly what the tokens say
 * through POST /tasks/structured, so nothing is parsed twice.
 */
export function CreateTaskPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const tz = useUserTimezone();
  const now = useNow();
  const haptic = useHapticFeedback();
  const [params] = useSearchParams();
  const categories = useCategories();
  const pending = useTasks();
  const create = useCreateTaskStructured();
  const undoCreate = useDeleteTask();
  const actions = useTaskActions();
  const input = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState('');
  // Fields the user set by hand win over whatever the parser says next.
  const [manual, setManual] = useState<Partial<Draft>>({});
  const [sheet, setSheet] = useState<SheetName>(null);
  const [titleInput, setTitleInput] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const close = () => setSheet(null);

  const trimmed = text.trim();
  const debounced = useDebouncedValue(trimmed, 450);
  const parse = useQuery({
    queryKey: ['parse', debounced],
    queryFn: () => api.parseText(debounced),
    enabled: debounced.length >= MIN_PARSE_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 0,
  });
  const parsed = trimmed.length >= MIN_PARSE_LENGTH ? parse.data : undefined;
  const understanding = trimmed.length >= MIN_PARSE_LENGTH && (debounced !== trimmed || parse.isFetching);

  useEffect(() => input.current?.focus(), []);
  useClosingConfirmation(trimmed.length > 0);

  // A day picked on Today is the fallback until the parser names one.
  const dayParam = params.get('day');
  const fallbackAt = useMemo(() => {
    const start = dayParam ? dayStart(dayParam, tz) : null;
    return start && dayKey(start, tz) !== dayKey(now, tz) ? atTimeInTz(start, tz, 9) : null;
  }, [dayParam, tz, now]);

  const list = categories.data ?? [];
  const fromText: Draft = {
    description: stripCategoryTags(parsed?.description ?? trimmed, list),
    scheduledAt: parsed?.scheduledAt ?? fallbackAt,
    recurrence: parsed?.recurrence ?? null,
    categoryId: suggestCategory(trimmed, list),
    leadMinutes: null,
    priority: 'normal',
  };
  const draft: Draft = { ...fromText, ...manual };
  const alternative = !('scheduledAt' in manual) && parsed ? ambiguousTime(trimmed, parsed.scheduledAt, tz) : null;
  const inPast = draft.scheduledAt !== null && draft.scheduledAt.getTime() <= now.getTime();
  const category = list.find((c) => c.id === draft.categoryId);
  const set = (patch: Partial<Draft>) => setManual((m) => ({ ...m, ...patch }));

  const ticks = useDayTicks(draft.scheduledAt, tz, now);
  const similar = useMemo(() => similarTasks(draft.description, pending.data ?? []), [draft.description, pending.data]);

  const ready = draft.description.length > 0 && !inPast && !understanding && !create.isPending;
  const submit = () => {
    if (!ready) return;
    haptic.impact('medium');
    create.mutate(
      {
        description: draft.description,
        scheduledAt: draft.scheduledAt,
        recurrence: draft.scheduledAt ? draft.recurrence : null,
        categoryId: draft.categoryId,
        leadMinutes: draft.scheduledAt ? draft.leadMinutes : null,
        priority: draft.priority,
        ...(trimmed ? { originalText: trimmed } : {}),
      },
      {
        onSuccess: (task) => {
          haptic.notify('success');
          const due = task.nextFireAt ?? task.scheduledAt;
          toast({
            message: due ? `Added for ${describeDue(due, tz, new Date())}` : 'Added to the Inbox',
            action: { label: 'Undo', onClick: () => undoCreate.mutate(task.id) },
          });
          setText('');
          goBack();
        },
        onError: () => {
          haptic.notify('error');
          toast({ message: "Couldn't add it. Try again.", tone: 'danger' });
        },
      },
    );
  };

  useMainButton({
    text: understanding ? 'Understanding…' : draft.scheduledAt || !trimmed ? 'Add reminder' : 'Add to Inbox',
    enabled: ready,
    loading: create.isPending,
    onClick: submit,
  });

  return (
    <Screen>
      <h1 className="px-4 pb-2 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">New reminder</h1>
      <Group>
        <AutoTextarea
          ref={input}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => setText(event.target.value)}
          placeholder="call mom tomorrow at 5 every week #personal"
          aria-label="What should Remy remind you about?"
          className="block min-h-[64px] w-full resize-none overflow-hidden bg-transparent px-3.5 pb-1 pt-3 text-[16px] font-bold leading-snug text-text outline-none placeholder:font-semibold placeholder:text-faint"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <p className="tnum flex items-center justify-between border-t-0 px-3.5 pb-2 text-[11px] font-bold text-faint">
          <span className="flex items-center gap-1 text-accent">
            {understanding ? (
              <>
                <Sparkles size={12} className="animate-pulse" /> Understanding…
              </>
            ) : null}
          </span>
          {text.length > 0 ? `${text.length} / ${MAX_LENGTH}` : null}
        </p>
      </Group>

      {trimmed ? (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3" aria-label="What Remy understood">
          <Token
            tone="plain"
            label="Edit title"
            onClick={() => {
              setTitleInput(draft.description);
              setSheet('title');
            }}
          >
            <span className="truncate">{draft.description || 'Title'}</span>
            <Pencil size={12} className="shrink-0 text-muted" />
          </Token>
          {draft.scheduledAt ? (
            <>
              <Token onClick={() => setSheet('when')}>{formatInTz(draft.scheduledAt, tz, 'EEE d MMM')}</Token>
              <Token tone={alternative || inPast ? 'confirm' : 'accent'} onClick={() => (alternative ? set({ scheduledAt: draft.scheduledAt }) : setSheet('when'))} label={alternative ? 'Keep this time' : 'Change time'}>
                {formatTime(draft.scheduledAt, tz)}
                {alternative ? '?' : ''}
                {inPast ? ' · passed' : ''}
              </Token>
              {alternative ? (
                <Token tone="add" onClick={() => set({ scheduledAt: alternative })}>
                  or {formatTime(alternative, tz)}
                </Token>
              ) : null}
            </>
          ) : (
            <Token tone="add" onClick={() => setSheet('when')}>
              + date · Inbox for now
            </Token>
          )}
          {draft.scheduledAt ? (
            <Token tone={draft.recurrence ? 'accent' : 'add'} onClick={() => setSheet('repeat')}>
              {draft.recurrence ? `↻ ${recurrenceLabel(draft.recurrence, tz)}` : '+ repeat'}
            </Token>
          ) : null}
          <Token tone={category ? 'accent' : 'add'} onClick={() => setSheet('category')}>
            {category ? (
              <>
                <i className="h-2 w-2 rounded-full" style={{ background: category.color }} />
                {category.name}
              </>
            ) : (
              '+ category'
            )}
          </Token>
          {draft.scheduledAt ? (
            <Token tone={draft.leadMinutes ? 'accent' : 'add'} onClick={() => setSheet('lead')}>
              {draft.leadMinutes ? leadLabel(draft.leadMinutes) : '+ remind before'}
            </Token>
          ) : null}
        </div>
      ) : (
        <p className="px-4 pt-3 text-[13.5px] font-semibold text-muted">Write it the way you'd say it. Remy picks out the day, time, repeat and category, and you can tap any of them to fix it.</p>
      )}

      {trimmed && alternative ? (
        <p className="px-4 pt-2 text-[12.5px] font-bold text-warn">“{trimmed.match(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\b/i)?.[0] ?? 'That time'}” could be morning or evening. Tap the one you mean.</p>
      ) : null}
      {parse.isError && !understanding ? <p className="px-4 pt-2 text-[12.5px] font-bold text-danger">Couldn't read a time from that. Set it below.</p> : null}

      {trimmed && draft.scheduledAt ? (
        <div className="pt-4">
          <LoadStrip
            ticks={[...ticks, { id: 'draft', minute: minuteOfDay(draft.scheduledAt, tz), tone: inPast ? 'danger' : 'accent' }]}
            highlight="draft"
            nowMinute={dayKey(draft.scheduledAt, tz) === dayKey(now, tz) ? minuteOfDay(now, tz) : null}
            label={`${formatInTz(draft.scheduledAt, tz, 'EEE d')} · ${inPast ? 'already passed' : relativeToNow(draft.scheduledAt, now)}`}
          />
        </div>
      ) : null}

      {similar.length > 0 ? (
        <>
          <SectionHeader label="Looks similar" />
          <Group>
            {similar.map((task) => {
              const due = task.nextFireAt ?? task.scheduledAt;
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  tz={tz}
                  tone={due && due.getTime() < now.getTime() ? 'overdue' : 'later'}
                  time={due ? formatTime(due, tz) : '—'}
                  timeSub={due ? formatInTz(due, tz, 'EEE d') : 'Inbox'}
                  onOpen={() => navigate(`/tasks/${task.id}`)}
                  onToggle={() => actions.complete(task)}
                />
              );
            })}
          </Group>
        </>
      ) : null}

      <SectionHeader label={trimmed ? 'Or set manually' : 'Details'} />
      <Group>
        <FieldRow icon={<CalendarClock size={16} />} label="When" value={draft.scheduledAt ? formatInTz(draft.scheduledAt, tz, 'EEE d MMM · HH:mm') : 'No date'} onClick={() => setSheet('when')} />
        <FieldRow
          icon={<Repeat size={16} />}
          iconTone="warn"
          label="Repeat"
          value={draft.scheduledAt ? (recurrenceLabel(draft.recurrence, tz) ?? 'Never') : 'Needs a date'}
          {...(draft.scheduledAt ? { onClick: () => setSheet('repeat') } : {})}
        />
        <FieldRow icon={<Tag size={16} />} iconTone="ok" label="Category" value={category?.name ?? 'None'} onClick={() => setSheet('category')} />
        {draft.scheduledAt ? <FieldRow icon={<Bell size={16} />} label="Remind" value={leadLabel(draft.leadMinutes)} onClick={() => setSheet('lead')} /> : null}
        <FieldRow icon={<Flag size={16} />} iconTone="danger" label="Priority" value={PRIORITY_LABEL[draft.priority]} onClick={() => setSheet('priority')} />
      </Group>

      <SectionHeader label="Voice" />
      <Group>
        <VoiceRecordButton
          onCreated={() => {
            toast({ message: 'Added from your voice note' });
            goBack();
          }}
          onError={setVoiceError}
        />
      </Group>
      {voiceError ? <p className="px-4 pt-2 text-[12.5px] font-bold text-danger">{voiceError}</p> : null}

      <Sheet
        open={sheet === 'title'}
        onClose={close}
        title="Title"
        footer={
          <Button
            variant="primary"
            block
            disabled={!titleInput.trim()}
            onClick={() => {
              set({ description: titleInput.trim() });
              close();
            }}
          >
            Use this title
          </Button>
        }
      >
        <AutoTextarea
          value={titleInput}
          onChange={(event) => setTitleInput(event.target.value.replace(/\n/g, ' '))}
          aria-label="Title"
          className="block w-full resize-none overflow-hidden rounded-xl border border-rule bg-past px-3 py-2.5 text-[16px] font-bold text-text outline-none"
        />
      </Sheet>
      <WhenSheet open={sheet === 'when'} onClose={close} value={draft.scheduledAt} now={now} allowClear onPick={(scheduledAt) => set({ scheduledAt })} />
      <RepeatSheet open={sheet === 'repeat'} onClose={close} value={draft.recurrence} at={draft.scheduledAt} onPick={(recurrence) => set({ recurrence })} />
      <CategorySheet open={sheet === 'category'} onClose={close} categories={list} value={draft.categoryId} onPick={(categoryId) => set({ categoryId })} />
      <LeadSheet open={sheet === 'lead'} onClose={close} value={draft.leadMinutes} onPick={(leadMinutes) => set({ leadMinutes })} />
      <PrioritySheet open={sheet === 'priority'} onClose={close} value={draft.priority} onPick={(priority) => set({ priority })} />
    </Screen>
  );
}
