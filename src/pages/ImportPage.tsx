import { Flag, ListPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryMap } from '@/features/categories';
import { useImportTasks, useParseList } from '@/features/data';
import { describeDue, recurrenceLabel, WhenSheet } from '@/features/reminders';
import type { ImportDraft } from '@/shared/api';
import { useUserTimezone } from '@/shared/lib/dates';
import { useBackHandler, useClosingConfirmation, useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import { useNow } from '@/shared/lib/useNow';
import { AutoTextarea, CheckCircle, Empty, Group, Pill, Screen, SectionHeader, toast } from '@/shared/ui';

const EXAMPLE = 'buy milk\ndentist tomorrow 10\ncall mom every sunday at 11\nrenew passport someday';
const MAX_LINES = 50;

/**
 * Paste a list; Remy reads each line; you untick what you don't want and
 * fix any time; Add creates exactly the ticked drafts in one request.
 */
export function ImportPage() {
  const navigate = useNavigate();
  const tz = useUserTimezone();
  const now = useNow();
  const haptic = useHapticFeedback();
  const categories = useCategoryMap();
  const parse = useParseList();
  const create = useImportTasks();

  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<ImportDraft[] | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);

  const lines = text.split('\n').filter((l) => l.trim()).length;
  const selected = drafts ? drafts.filter((_, i) => !skipped.has(i)) : [];
  // Same rule as the When sheet and Create (F15): a time that has already
  // passed is not saved. The row turns red; fix it or leave the line out.
  const isPast = (draft: ImportDraft) => draft.scheduledAt !== null && draft.scheduledAt.getTime() <= now.getTime();
  const pastCount = selected.filter(isPast).length;
  useClosingConfirmation(text.trim().length > 0 && !create.isSuccess);
  // Back from the review returns to the list instead of leaving.
  useBackHandler(drafts !== null, () => setDrafts(null));

  const read = () =>
    parse.mutate(text, {
      onSuccess: (result) => {
        haptic.notify('success');
        setDrafts(result);
        setSkipped(new Set());
      },
      onError: () => toast({ message: "Couldn't read the list. Try again.", tone: 'danger' }),
    });

  const add = () =>
    create.mutate(
      selected.map((d) => ({
        description: d.description,
        notes: d.notes,
        scheduledAt: d.scheduledAt,
        recurrence: d.scheduledAt ? d.recurrence : null,
        priority: d.priority,
        categoryId: d.categoryId,
        leadMinutes: d.scheduledAt ? d.leadMinutes : null,
      })),
      {
        onSuccess: (created) => {
          haptic.notify('success');
          toast({ message: `Added ${created.length} ${created.length === 1 ? 'reminder' : 'reminders'}` });
          navigate('/', { replace: true });
        },
        onError: () => toast({ message: "Couldn't add them. Nothing was saved; try again.", tone: 'danger' }),
      },
    );

  useMainButton(
    drafts === null
      ? { text: parse.isPending ? 'Reading…' : 'Read the list', enabled: lines > 0 && lines <= MAX_LINES && !parse.isPending, loading: parse.isPending, onClick: read }
      : {
          text: pastCount
            ? `Fix ${pastCount} past ${pastCount === 1 ? 'time' : 'times'}`
            : selected.length
              ? `Add ${selected.length} ${selected.length === 1 ? 'reminder' : 'reminders'}`
              : 'Nothing selected',
          enabled: selected.length > 0 && pastCount === 0 && !create.isPending,
          loading: create.isPending,
          onClick: add,
        },
  );

  if (drafts === null) {
    return (
      <Screen>
        <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Import a list</h1>
        <p className="px-4 pb-3 text-[13.5px] font-semibold text-muted">
          Paste a to-do list from Notes or anywhere else, one thing per line. Remy reads the times; lines without one go to the Inbox. You check everything before it's added.
        </p>
        <Group>
          <AutoTextarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={EXAMPLE}
            aria-label="Your list"
            className="block min-h-[180px] w-full resize-none overflow-hidden bg-transparent px-3.5 py-3 text-[15px] font-semibold leading-relaxed text-text outline-none placeholder:text-faint"
          />
        </Group>
        <p className={`tnum px-4 pt-2 text-[12.5px] font-bold ${lines > MAX_LINES ? 'text-danger' : 'text-muted'}`}>
          {lines === 0 ? `Up to ${MAX_LINES} lines.` : `${lines} ${lines === 1 ? 'line' : 'lines'}${lines > MAX_LINES ? ` · at most ${MAX_LINES} at a time` : ''}`}
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Check the list</h1>
      <SectionHeader
        label={`${drafts.length} found · ${selected.length} to add`}
        right={
          <button type="button" className="-my-2 min-h-11 px-1" onClick={() => setDrafts(null)}>
            Edit list
          </button>
        }
      />
      {drafts.length === 0 ? (
        <Empty icon={<ListPlus size={20} />} title="Nothing to add" body="Every line was empty. Go back and paste your list." />
      ) : (
        <Group>
          {drafts.map((draft, i) => {
            const on = !skipped.has(i);
            const repeat = recurrenceLabel(draft.recurrence, tz);
            const category = draft.categoryId ? categories.get(draft.categoryId) : undefined;
            const past = on && isPast(draft);
            return (
              <div key={i} className={`flex min-h-row items-center gap-3 py-row-y pl-3.5 pr-2 ${on ? '' : 'opacity-45'}`}>
                <CheckCircle
                  done={on}
                  label={on ? `Skip ${draft.description}` : `Add ${draft.description}`}
                  onToggle={() =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-extrabold leading-tight">
                    {draft.priority === 'high' ? <Flag size={12} aria-label="High priority" className="mr-1 inline -translate-y-px fill-danger text-danger" /> : null}
                    {draft.description}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {repeat ? <Pill>↻ {repeat}</Pill> : null}
                    {category ? <Pill>{category.name}</Pill> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(i)}
                  aria-label={past ? `${draft.description}: the time has passed, pick another` : undefined}
                  className={`tnum min-h-11 shrink-0 rounded-xl px-2.5 text-right text-[12.5px] font-extrabold ${past ? 'text-danger' : draft.scheduledAt ? 'text-accent' : 'text-muted'}`}
                >
                  {draft.scheduledAt ? describeDue(draft.scheduledAt, tz, now) : 'Inbox'}
                  {past ? <span className="block text-[11px]">passed · change</span> : null}
                </button>
              </div>
            );
          })}
        </Group>
      )}
      {pastCount > 0 ? (
        <p className="px-4 pt-2 text-[12.5px] font-bold text-danger">
          {pastCount === 1 ? 'One time has' : `${pastCount} times have`} already passed. Tap it to pick a new one, or leave the line out.
        </p>
      ) : null}
      <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">Tap a circle to leave a line out, or a time to change it.</p>

      <WhenSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        value={editing !== null ? (drafts[editing]?.scheduledAt ?? null) : null}
        now={now}
        allowClear
        onPick={(at) => {
          const index = editing;
          if (index === null) return;
          setDrafts((prev) =>
            prev
              ? prev.map((d, i) => (i === index ? { ...d, scheduledAt: at, ...(at ? {} : { recurrence: null, leadMinutes: null }) } : d))
              : prev,
          );
        }}
      />
    </Screen>
  );
}
