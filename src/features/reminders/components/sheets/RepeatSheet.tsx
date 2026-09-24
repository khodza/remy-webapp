import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Recurrence } from '@/shared/api';
import { formatInTz, useUserTimezone } from '@/shared/lib/dates';
import { Button, IconButton, Sheet, SheetOption } from '@/shared/ui';
import { isCustomRecurrence, recurrenceLabel } from '../../lib/recurrence';

interface RepeatSheetProps {
  open: boolean;
  onClose: () => void;
  value: Recurrence | null;
  /** The reminder's time, to name the weekday / day of month. */
  at: Date | null;
  onPick: (value: Recurrence | null) => void;
}

const same = (a: Recurrence | null, b: Recurrence | null) =>
  a === null || b === null
    ? a === b
    : a.type === b.type && (a.intervalDays ?? 1) === (b.intervalDays ?? 1) && !isCustomRecurrence(a);

/** The rule with "× N times" (0 = no limit); a fresh rule drops a chat-made `until`. */
function withCount(rule: Recurrence | null, count: number): Recurrence | null {
  if (!rule) return null;
  const rest: Recurrence = { ...rule };
  delete rest.count;
  return count > 0 ? { ...rest, count } : rest;
}

/** Never, daily, weekdays, weekly, monthly, yearly, every N days; "× N times". */
export function RepeatSheet({ open, onClose, value, at, onPick }: RepeatSheetProps) {
  const tz = useUserTimezone();
  const [days, setDays] = useState(value?.type === 'every_n_days' ? (value.intervalDays ?? 2) : 2);
  const [count, setCount] = useState(value?.count ?? 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCount(value?.count ?? 0);
  }
  const custom = isCustomRecurrence(value);
  const pick = (next: Recurrence | null) => {
    onPick(withCount(next, count));
    onClose();
  };
  const options: Array<{ label: string; detail?: string; value: Recurrence | null }> = [
    { label: 'Never', value: null },
    { label: 'Every day', value: { type: 'daily' } },
    { label: 'Every weekday', detail: 'Monday to Friday', value: { type: 'weekdays' } },
    { label: 'Every week', ...(at ? { detail: `On ${formatInTz(at, tz, 'EEEE')}` } : {}), value: { type: 'weekly' } },
    {
      label: 'Every month',
      ...(at ? { detail: `On the ${formatInTz(at, tz, 'do')}` } : {}),
      value: { type: 'monthly' },
    },
    { label: 'Every year', ...(at ? { detail: `On ${formatInTz(at, tz, 'd MMMM')}` } : {}), value: { type: 'yearly' } },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Repeat">
      <div className="-mx-1">
        {custom ? (
          <SheetOption
            label={recurrenceLabel(value, tz) ?? 'Custom'}
            detail="Set in chat. Pick another option to replace it."
            selected
            onClick={onClose}
          />
        ) : null}
        {options.map((option) => (
          <SheetOption
            key={option.label}
            label={option.label}
            detail={option.detail}
            selected={same(value, option.value)}
            onClick={() => pick(option.value)}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-xl bg-past py-1 pl-3 pr-1">
        <span className="flex-1 text-[14.5px] font-bold">Every</span>
        <IconButton label="Fewer days" onClick={() => setDays((d) => Math.max(2, d - 1))}>
          <Minus size={16} />
        </IconButton>
        <span className="tnum w-14 text-center text-[15px] font-extrabold">{days} days</span>
        <IconButton label="More days" onClick={() => setDays((d) => Math.min(365, d + 1))}>
          <Plus size={16} />
        </IconButton>
        <Button
          variant={value?.type === 'every_n_days' && value.intervalDays === days ? 'primary' : 'secondary'}
          className="px-3"
          onClick={() => pick({ type: 'every_n_days', intervalDays: days })}
        >
          Set
        </Button>
      </div>
      {value ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-past py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold">Stop after</span>
            <span className="block text-[11.5px] font-semibold text-muted">Done and skipped both count</span>
          </span>
          <IconButton label="Fewer times" onClick={() => setCount((c) => Math.max(0, c - 1))}>
            <Minus size={16} />
          </IconButton>
          <span className="tnum w-16 text-center text-[14px] font-extrabold">
            {count === 0 ? 'No limit' : `${count} times`}
          </span>
          <IconButton label="More times" onClick={() => setCount((c) => Math.min(1000, c === 0 ? 2 : c + 1))}>
            <Plus size={16} />
          </IconButton>
          <Button
            variant={(value.count ?? 0) === count ? 'secondary' : 'primary'}
            className="px-3"
            aria-label="Set how many times"
            disabled={(value.count ?? 0) === count}
            onClick={() => {
              onPick(withCount(value, count));
              onClose();
            }}
          >
            Set
          </Button>
        </div>
      ) : null}
      <p className="mt-3 text-[12.5px] font-semibold text-muted">
        Rules like “every Mon and Thu until December” can be set by telling the bot.
      </p>
    </Sheet>
  );
}
