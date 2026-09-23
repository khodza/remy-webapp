import { CalendarX2 } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime, fromLocalInputValue, relativeToNow, toLocalInputValue, useUserTimezone } from '@/shared/lib/dates';
import { Button, Sheet, SheetOption } from '@/shared/ui';
import { quickTimes } from '../../lib/when';

interface WhenSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  value: Date | null;
  now: Date;
  onPick: (at: Date | null) => void;
  /** Offer "No date" (turns a reminder into an Inbox todo). */
  allowClear?: boolean;
  /** Shown under the options, e.g. "Changes every occurrence". */
  note?: string;
}

function defaultInput(value: Date | null, now: Date, tz: string): string {
  const base = value && value.getTime() > now.getTime() ? value : new Date(Math.ceil((now.getTime() + 3600_000) / 3600_000) * 3600_000);
  return toLocalInputValue(base, tz);
}

/** Quick picks with their exact time, or a date + time of your own. */
export function WhenSheet({ open, onClose, title = 'When', value, now, onPick, allowClear, note }: WhenSheetProps) {
  const tz = useUserTimezone();
  const [input, setInput] = useState(() => defaultInput(value, now, tz));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setInput(defaultInput(value, now, tz));
  }

  const [datePart = '', timePart = ''] = input.split('T');
  const custom = fromLocalInputValue(input, tz);
  const inPast = custom !== null && custom.getTime() <= now.getTime();
  const pick = (at: Date | null) => {
    onPick(at);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="primary" block disabled={!custom || inPast} onClick={() => custom && pick(custom)}>
          {custom && !inPast ? `Set ${formatDateTime(custom, tz)}` : 'Pick a time in the future'}
        </Button>
      }
    >
      <div className="-mx-1">
        {quickTimes(now, tz).map((quick) => (
          <SheetOption key={quick.key} label={quick.label} detail={formatDateTime(quick.at, tz)} onClick={() => pick(quick.at)} />
        ))}
        {allowClear ? (
          <SheetOption label="No date" detail="Keep it in the Inbox" icon={<CalendarX2 size={17} className="text-muted" />} selected={value === null} onClick={() => pick(null)} />
        ) : null}
      </div>

      <p className="mb-2 mt-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">Pick a date and time</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          type="date"
          aria-label="Date"
          value={datePart}
          min={toLocalInputValue(now, tz).slice(0, 10)}
          onChange={(event) => setInput(`${event.target.value}T${timePart || '09:00'}`)}
          className="tnum min-h-12 w-full min-w-0 rounded-xl border border-rule bg-past px-2.5 text-[15px] font-bold text-text"
        />
        <input
          type="time"
          aria-label="Time"
          value={timePart}
          step={300}
          onChange={(event) => setInput(`${datePart}T${event.target.value}`)}
          className="tnum min-h-12 min-w-0 rounded-xl border border-rule bg-past px-2.5 text-[15px] font-bold text-text"
        />
      </div>
      <p className={`tnum mt-2 text-[12.5px] font-bold ${inPast ? 'text-danger' : 'text-muted'}`}>
        {custom ? (inPast ? 'That time has passed.' : relativeToNow(custom, now)) : 'Pick a date and a time.'}
      </p>
      {note ? <p className="mt-1 text-[12.5px] font-semibold text-muted">{note}</p> : null}
    </Sheet>
  );
}
