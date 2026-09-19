import { BellRing, Flag, Moon } from 'lucide-react';
import { useState } from 'react';
import {
  DEFAULT_FIRST_NUDGE,
  FIRST_NUDGE_OPTIONS,
  minutesLabel,
  nudgeSteps,
  QuietBar,
  SECOND_NUDGE_OPTIONS,
  useSaveSettings,
  useSettings,
} from '@/features/settings';
import { minuteOfDay } from '@/features/today';
import { useUserTimezone } from '@/shared/lib/dates';
import { useNow } from '@/shared/lib/useNow';
import { FieldRow, Group, Screen, SectionHeader, Sheet, SheetOption, SkeletonRows, TimeField, Toggle } from '@/shared/ui';

/** Quiet hours with a 24 h bar, and how hard Remy nudges when ignored. */
export function QuietHoursPage() {
  const settings = useSettings();
  const save = useSaveSettings();
  const tz = useUserTimezone();
  const now = useNow();
  const [picking, setPicking] = useState<'first' | 'second' | null>(null);
  const s = settings.data;

  if (!s) {
    return (
      <Screen>
        <div className="pt-4">
          <SkeletonRows count={4} />
        </div>
      </Screen>
    );
  }

  const q = s.quietHours;
  const first = s.escalation.stepsMinutes[0] ?? DEFAULT_FIRST_NUDGE;
  const second = s.escalation.stepsMinutes[1] ?? null;

  return (
    <Screen>
      <h1 className="px-4 pb-3 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Quiet hours & nudges</h1>
      <QuietBar from={q.from} to={q.to} enabled={q.enabled} nowMinute={minuteOfDay(now, tz)} />

      <SectionHeader label="Quiet hours" />
      <Group>
        <FieldRow icon={<Moon size={16} />} label="Hold reminders at night" trailing={<Toggle checked={q.enabled} onChange={(enabled) => save({ quietHours: { enabled } })} label="Quiet hours" />} />
        <FieldRow label="From" trailing={<TimeField value={q.from} disabled={!q.enabled} onChange={(from) => save({ quietHours: { from } })} label="Quiet hours start" />} />
        <FieldRow label="Until" trailing={<TimeField value={q.to} disabled={!q.enabled} onChange={(to) => save({ quietHours: { to } })} label="Quiet hours end" />} />
        <FieldRow
          icon={<Flag size={16} />}
          iconTone="danger"
          label="High priority still rings"
          trailing={<Toggle checked={q.allowHighPriority} disabled={!q.enabled} onChange={(allowHighPriority) => save({ quietHours: { allowHighPriority } })} label="High priority rings during quiet hours" />}
        />
      </Group>
      <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">Reminders due in this window arrive when it ends.</p>

      <SectionHeader label="If a reminder is ignored" />
      <Group>
        <FieldRow icon={<BellRing size={16} />} iconTone="danger" label="Nudge again" trailing={<Toggle checked={s.escalation.enabled} onChange={(enabled) => save({ escalation: { enabled } })} label="Nudge if ignored" />} />
        <FieldRow label="First nudge" value={`after ${minutesLabel(first)}`} {...(s.escalation.enabled ? { onClick: () => setPicking('first') } : {})} />
        <FieldRow label="Second nudge" value={second ? `after ${minutesLabel(second)}` : 'None'} {...(s.escalation.enabled ? { onClick: () => setPicking('second') } : {})} />
      </Group>
      <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">Counted from the reminder. Low-priority reminders are never nudged.</p>

      <Sheet open={picking === 'first'} onClose={() => setPicking(null)} title="First nudge">
        <div className="-mx-1">
          {FIRST_NUDGE_OPTIONS.map((m) => (
            <SheetOption
              key={m}
              label={`After ${minutesLabel(m)}`}
              selected={first === m}
              onClick={() => {
                save({ escalation: { stepsMinutes: nudgeSteps(m, second) } });
                setPicking(null);
              }}
            />
          ))}
        </div>
      </Sheet>
      <Sheet open={picking === 'second'} onClose={() => setPicking(null)} title="Second nudge">
        <div className="-mx-1">
          <SheetOption
            label="None"
            selected={second === null}
            onClick={() => {
              save({ escalation: { stepsMinutes: [first] } });
              setPicking(null);
            }}
          />
          {SECOND_NUDGE_OPTIONS.filter((m) => m > first).map((m) => (
            <SheetOption
              key={m}
              label={`After ${minutesLabel(m)}`}
              selected={second === m}
              onClick={() => {
                save({ escalation: { stepsMinutes: nudgeSteps(first, m) } });
                setPicking(null);
              }}
            />
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}
