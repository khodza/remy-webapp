import { formatTime, useUserTimezone } from '@/shared/lib/dates';
import { Chip } from '@/shared/ui';
import { snoozeOptions, type SnoozeOption } from '../lib/when';

interface SnoozeChipsProps {
  due: Date | null;
  now: Date;
  onPick: (option: SnoozeOption) => void;
  disabled?: boolean;
}

/** +15m, +1h, Tonight, Tomorrow, each with the time it lands on. */
export function SnoozeChips({ due, now, onPick, disabled }: SnoozeChipsProps) {
  const tz = useUserTimezone();
  return (
    <div className="grid grid-cols-4 gap-1.5 px-4">
      {snoozeOptions(due, now, tz).map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          sub={option.key === 'next-week' ? `Mon ${formatTime(option.at, tz)}` : formatTime(option.at, tz)}
          onClick={() => onPick(option)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
