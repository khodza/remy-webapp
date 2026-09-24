import { CalendarX2 } from 'lucide-react';
import { useState } from 'react';
import {
  atTimeInTz,
  endOfDayInTz,
  formatDateTime,
  formatDayShort,
  fromLocalInputValue,
  relativeToNow,
  toLocalInputValue,
  useUserTimezone,
} from '@/shared/lib/dates';
import { Button, Sheet, SheetOption, Toggle } from '@/shared/ui';
import { quickTimes } from '../../lib/when';

interface WhenSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  value: Date | null;
  now: Date;
  /** `allDay` is true when the user chose a date with no specific time. */
  onPick: (at: Date | null, allDay?: boolean) => void;
  /** Offer "No date" (turns a reminder into an Inbox todo). */
  allowClear?: boolean;
  /** Offer "No specific time": a date only (Remy pings it at 09:00). */
  allowAllDay?: boolean;
  /** The current value is all-day. */
  allDay?: boolean;
  /** Shown under the options, e.g. "Changes every occurrence". */
  note?: string;
}

function defaultInput(value: Date | null, now: Date, tz: string): string {
  const base =
    value && value.getTime() > now.getTime()
      ? value
      : new Date(Math.ceil((now.getTime() + 3600_000) / 3600_000) * 3600_000);
  return toLocalInputValue(base, tz);
}

/**
 * Quick picks with their exact time, or a date + time of your own; with
 * `allowAllDay`, a date with no specific time (an all-day task).
 */
export function WhenSheet({
  open,
  onClose,
  title = 'When',
  value,
  now,
  onPick,
  allowClear,
  allowAllDay,
  allDay = false,
  note,
}: WhenSheetProps) {
  const tz = useUserTimezone();
  const [input, setInput] = useState(() => defaultInput(value, now, tz));
  const [noTime, setNoTime] = useState(allDay);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setInput(defaultInput(value, now, tz));
      setNoTime(allDay);
    }
  }

  const [datePart = '', timePart = ''] = input.split('T');
  const timed = fromLocalInputValue(input, tz);
  // An all-day task is stored at 09:00 on its date; it is "past" only once the day is over.
  const wholeDay = noTime && timed ? atTimeInTz(timed, tz, 9) : null;
  const custom = noTime ? wholeDay : timed;
  const inPast =
    custom !== null &&
    (noTime ? endOfDayInTz(custom, tz).getTime() <= now.getTime() : custom.getTime() <= now.getTime());
  const pick = (at: Date | null, isAllDay = false) => {
    onPick(at, isAllDay);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="primary" block disabled={!custom || inPast} onClick={() => custom && pick(custom, noTime)}>
          {custom && !inPast
            ? noTime
              ? `Set ${formatDayShort(custom, tz)} · all day`
              : `Set ${formatDateTime(custom, tz)}`
            : noTime
              ? 'Pick a day that is not over'
              : 'Pick a time in the future'}
        </Button>
      }
    >
      <div className="-mx-1">
        {quickTimes(now, tz).map((quick) => (
          <SheetOption
            key={quick.key}
            label={quick.label}
            detail={formatDateTime(quick.at, tz)}
            onClick={() => pick(quick.at)}
          />
        ))}
        {allowClear ? (
          <SheetOption
            label="No date"
            detail="Keep it in the Inbox"
            icon={<CalendarX2 size={17} className="text-muted" />}
            selected={value === null}
            onClick={() => pick(null)}
          />
        ) : null}
      </div>

      <p className="mb-2 mt-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">
        {noTime ? 'Pick a date' : 'Pick a date and time'}
      </p>
      <div className={noTime ? 'grid' : 'grid grid-cols-[minmax(0,1fr)_auto] gap-2'}>
        <input
          type="date"
          aria-label="Date"
          value={datePart}
          min={toLocalInputValue(now, tz).slice(0, 10)}
          onChange={(event) => setInput(`${event.target.value}T${timePart || '09:00'}`)}
          className="tnum min-h-12 w-full min-w-0 rounded-xl border border-rule bg-past px-2.5 text-[15px] font-bold text-text"
        />
        {noTime ? null : (
          <input
            type="time"
            aria-label="Time"
            value={timePart}
            step={300}
            onChange={(event) => setInput(`${datePart}T${event.target.value}`)}
            className="tnum min-h-12 min-w-0 rounded-xl border border-rule bg-past px-2.5 text-[15px] font-bold text-text"
          />
        )}
      </div>
      {allowAllDay ? (
        <div className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-past py-1 pl-3 pr-1">
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">No specific time</span>
            <span className="block text-[12px] font-semibold text-muted">Just the day. Remy pings it at 09:00.</span>
          </span>
          <Toggle checked={noTime} onChange={setNoTime} label="No specific time" />
        </div>
      ) : null}
      <p className={`tnum mt-2 text-[12.5px] font-bold ${inPast ? 'text-danger' : 'text-muted'}`}>
        {custom
          ? inPast
            ? noTime
              ? 'That day is over.'
              : 'That time has passed.'
            : noTime
              ? formatDayShort(custom, tz)
              : relativeToNow(custom, now)
          : noTime
            ? 'Pick a date.'
            : 'Pick a date and a time.'}
      </p>
      {note ? <p className="mt-1 text-[12.5px] font-semibold text-muted">{note}</p> : null}
    </Sheet>
  );
}
