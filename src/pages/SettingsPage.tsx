import {
  BellOff,
  BellRing,
  CalendarDays,
  CalendarPlus,
  Clock,
  FileDown,
  Globe,
  LayoutList,
  ListPlus,
  Moon,
  Newspaper,
  Rows3,
  Pin,
  Sun,
  Tag,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '@/features/categories';
import { DeleteAllDataSheet, useCalendarFeed, useExportData } from '@/features/data';
import { useMe } from '@/features/profile';
import { nudgeSummary, useSaveSettings, useSettings, zoneCity } from '@/features/settings';
import { useTodayView } from '@/features/today';
import { CONTRACT_VERSION, type Settings } from '@/shared/api';
import { formatClock, formatTime, getDeviceTimezone, useHour12, useUserTimezone } from '@/shared/lib/dates';
import { useDensity } from '@/shared/lib/density';
import { useNow } from '@/shared/lib/useNow';
import {
  Empty,
  FieldRow,
  Group,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  SheetOption,
  SkeletonRows,
  TimeField,
  toast,
  Toggle,
} from '@/shared/ui';

type RhythmKey = 'morningBrief' | 'eveningReview';

const RHYTHM: Record<RhythmKey, { title: string; body: string }> = {
  morningBrief: {
    title: 'Morning brief',
    body: "One message with today's plan, anything overdue from yesterday, and the Inbox, with buttons to reschedule or catch up.",
  },
  eveningReview: {
    title: 'Evening review',
    body: "What's still open today, one tap each: tomorrow morning, drop, or keep. The weekly wrap is sent at this time too.",
  },
};

export function SettingsPage() {
  const navigate = useNavigate();
  const me = useMe();
  const settings = useSettings();
  const categories = useCategories();
  const save = useSaveSettings();
  const [view, setView] = useTodayView();
  const [editing, setEditing] = useState<RhythmKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const feed = useCalendarFeed();
  const exportData = useExportData();
  const hour12 = useHour12();
  const [density, setDensity] = useDensity();
  const now = useNow();
  const zone = useUserTimezone();

  const tz = me.data?.timezone ?? null;
  const detected = tz !== null && tz === getDeviceTimezone();
  const s = settings.data;

  return (
    <Screen>
      <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Settings</h1>

      {me.data ? (
        <div className="flex items-center gap-3 px-4 pb-1 pt-2">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-[19px] font-extrabold text-accent-fg">
            {me.data.firstName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-extrabold">
              {me.data.firstName}
              {me.data.lastName ? ` ${me.data.lastName}` : ''}
            </span>
            <span className="block truncate text-[12.5px] font-bold text-muted">
              {[
                me.data.username ? `@${me.data.username}` : null,
                tz ? `${zoneCity(tz)}${detected ? ', detected' : ''}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </div>
      ) : null}

      {!s ? (
        <div className="pt-4">
          {settings.isError ? (
            <Empty title="Couldn't load your settings" body="Check the connection and reopen this screen." />
          ) : (
            <SkeletonRows count={5} />
          )}
        </div>
      ) : (
        <>
          <SectionHeader label="Messages from Remy" />
          <Group>
            <FieldRow
              icon={<Sun size={16} />}
              iconTone="warn"
              label="Morning brief"
              value={s.morningBrief.enabled ? formatClock(s.morningBrief.time, hour12) : 'Off'}
              onClick={() => setEditing('morningBrief')}
            />
            <FieldRow
              icon={<Moon size={16} />}
              label="Evening review"
              value={s.eveningReview.enabled ? formatClock(s.eveningReview.time, hour12) : 'Off'}
              onClick={() => setEditing('eveningReview')}
            />
            <FieldRow
              icon={<Newspaper size={16} />}
              iconTone="ok"
              label="Weekly wrap"
              hint={`${s.weekStartsOn === 1 ? 'Sunday' : 'Saturday'} at ${formatClock(s.eveningReview.time, hour12)}`}
              trailing={
                <Toggle
                  checked={s.weeklyWrap.enabled}
                  onChange={(enabled) => save({ weeklyWrap: { enabled } })}
                  label="Weekly wrap"
                />
              }
            />
            <FieldRow
              icon={<Volume2 size={16} />}
              label="Voice brief"
              hint="The morning brief also read aloud, as a voice message"
              trailing={
                <Toggle checked={s.voiceBrief} onChange={(voiceBrief) => save({ voiceBrief })} label="Voice brief" />
              }
            />
            <FieldRow
              icon={<Pin size={16} />}
              iconTone="warn"
              label="Pinned agenda in chat"
              hint="A live Today message, pinned and kept up to date"
              trailing={
                <Toggle
                  checked={s.pinnedAgenda}
                  onChange={(pinnedAgenda) => save({ pinnedAgenda })}
                  label="Pinned agenda in chat"
                />
              }
            />
          </Group>

          <SectionHeader label="Reminders" />
          <Group>
            <FieldRow
              icon={<BellOff size={16} />}
              iconTone="accent"
              label="Quiet hours"
              value={
                s.quietHours.enabled
                  ? `${formatClock(s.quietHours.from, hour12)} – ${formatClock(s.quietHours.to, hour12)}`
                  : 'Off'
              }
              onClick={() => navigate('/settings/quiet')}
            />
            <FieldRow
              icon={<BellRing size={16} />}
              iconTone="danger"
              label="If ignored, nudge again"
              value={
                s.escalation.enabled && s.escalation.stepsMinutes.length
                  ? nudgeSummary(s.escalation.stepsMinutes)
                  : 'Off'
              }
              onClick={() => navigate('/settings/quiet')}
            />
          </Group>

          <SectionHeader label="Organisation" />
          <Group>
            <FieldRow
              icon={<Tag size={16} />}
              iconTone="ok"
              label="Categories"
              value={categories.data ? String(categories.data.length) : undefined}
              onClick={() => navigate('/settings/categories')}
            />
            <FieldRow
              icon={<LayoutList size={16} />}
              label="Today opens in"
              trailing={
                <Segmented
                  label="Today opens in"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'timeline', label: 'Timeline' },
                    { value: 'list', label: 'List' },
                  ]}
                />
              }
            />
            <FieldRow
              icon={<Rows3 size={16} />}
              iconTone="warn"
              label="Compact rows"
              hint="More on screen · this phone only"
              trailing={
                <Toggle
                  checked={density === 'compact'}
                  onChange={(on) => setDensity(on ? 'compact' : 'comfortable')}
                  label="Compact rows"
                />
              }
            />
          </Group>

          <SectionHeader label="Region" />
          <Group>
            <FieldRow
              icon={<Globe size={16} />}
              label="Time zone"
              value={tz ? `${zoneCity(tz)}${detected ? ' · auto' : ''}` : 'Detecting…'}
              onClick={() => navigate('/settings/timezone')}
            />
            <FieldRow
              icon={<Clock size={16} />}
              iconTone="ok"
              label="Time format"
              hint={`Now ${formatTime(now, zone, s.hour12)}`}
              trailing={
                <Segmented
                  label="Time format"
                  value={s.hour12 ? '12' : '24'}
                  onChange={(value) => save({ hour12: value === '12' })}
                  options={[
                    { value: '24', label: '24 h' },
                    { value: '12', label: '12 h' },
                  ]}
                />
              }
            />
            <FieldRow
              icon={<CalendarDays size={16} />}
              iconTone="warn"
              label="Week starts on"
              trailing={
                <Segmented
                  label="Week starts on"
                  value={String(s.weekStartsOn) as '0' | '1'}
                  onChange={(value) => save({ weekStartsOn: value === '1' ? 1 : 0 })}
                  options={[
                    { value: '1', label: 'Monday' },
                    { value: '0', label: 'Sunday' },
                  ]}
                />
              }
            />
          </Group>

          <SectionHeader label="Your data" />
          <Group>
            <FieldRow
              icon={<CalendarPlus size={16} />}
              label="Calendar feed"
              hint="Reminders in Google or Apple Calendar"
              value={feed.data ? (feed.data.enabled ? 'On' : 'Off') : undefined}
              onClick={() => navigate('/settings/calendar')}
            />
            <FieldRow
              icon={<FileDown size={16} />}
              iconTone="ok"
              label="Export"
              hint="A file in your chat"
              value="CSV · JSON · ICS"
              onClick={() => setExporting(true)}
            />
            <FieldRow
              icon={<ListPlus size={16} />}
              iconTone="warn"
              label="Import a list"
              hint="Paste lines, check, add"
              onClick={() => navigate('/settings/import')}
            />
          </Group>
          <Group className="mt-4">
            <FieldRow
              icon={<Trash2 size={16} />}
              iconTone="danger"
              label="Delete all data"
              hint="Every task, category and memory; settings back to defaults"
              danger
              onClick={() => setDeleting(true)}
            />
          </Group>

          <RhythmSheet editing={editing} settings={s} onClose={() => setEditing(null)} />
          <Sheet open={exporting} onClose={() => setExporting(false)} title="Export">
            <p className="pb-2 text-[13.5px] font-semibold text-muted">
              Remy sends the file to your chat, where you can save or share it. Times are in your time zone.
            </p>
            <div className="-mx-1">
              {(
                [
                  { format: 'csv', label: 'Spreadsheet (CSV)', detail: 'Pending and done · Excel, Numbers, Sheets' },
                  {
                    format: 'json',
                    label: 'Full record (JSON)',
                    detail: 'Settings, categories, every task · for backups',
                  },
                  {
                    format: 'ics',
                    label: 'Calendar file (.ics)',
                    detail: 'Pending reminders · import into any calendar',
                  },
                ] as const
              ).map((option) => (
                <SheetOption
                  key={option.format}
                  label={option.label}
                  detail={option.detail}
                  onClick={() => {
                    setExporting(false);
                    exportData.mutate(option.format, {
                      onSuccess: (result) =>
                        toast({
                          message: `Sent ${result.filename} to your chat (${result.tasks} ${option.format === 'ics' ? 'reminders' : 'tasks'})`,
                        }),
                      onError: () => toast({ message: "Couldn't export. Try again.", tone: 'danger' }),
                    });
                  }}
                />
              ))}
            </div>
          </Sheet>
          <DeleteAllDataSheet open={deleting} onClose={() => setDeleting(false)} />
        </>
      )}

      <p className="tnum px-4 pt-6 text-center text-[11.5px] font-semibold text-faint">
        Remy · contract {CONTRACT_VERSION}
      </p>
    </Screen>
  );
}

function RhythmSheet({
  editing,
  settings,
  onClose,
}: {
  editing: RhythmKey | null;
  settings: Settings;
  onClose: () => void;
}) {
  const save = useSaveSettings();
  const key = editing ?? 'morningBrief';
  const value = settings[key];
  return (
    <Sheet open={editing !== null} onClose={onClose} title={RHYTHM[key].title}>
      <p className="pb-3 text-[13.5px] font-semibold text-muted">{RHYTHM[key].body}</p>
      <Group className="mx-0">
        <FieldRow
          label="Send it"
          trailing={
            <Toggle
              checked={value.enabled}
              onChange={(enabled) => save({ [key]: { enabled } })}
              label={RHYTHM[key].title}
            />
          }
        />
        <FieldRow
          label="At"
          trailing={
            <TimeField
              value={value.time}
              disabled={!value.enabled}
              onChange={(time) => save({ [key]: { time } })}
              label={`${RHYTHM[key].title} time`}
            />
          }
        />
      </Group>
    </Sheet>
  );
}
