import { formatClock, formatHour } from '@/shared/lib/dates';
import { quietSegments, toMinutes } from '../lib/nudges';

/** The whole day with the quiet window shaded and now marked. */
export function QuietBar({
  from,
  to,
  enabled,
  nowMinute,
}: {
  from: string;
  to: string;
  enabled: boolean;
  nowMinute: number;
}) {
  return (
    <div
      className="px-4"
      aria-label={enabled ? `Quiet from ${formatClock(from)} to ${formatClock(to)}` : 'Quiet hours off'}
    >
      <div className="relative h-8 overflow-hidden rounded-lg bg-accent-soft">
        {enabled
          ? quietSegments(from, to).map(([left, width]) => (
              <i
                key={left}
                className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_2px,transparent_2px_7px)] opacity-35"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            ))
          : null}
        <i
          className="absolute inset-y-0 border-l-2 border-now"
          style={{ left: `${(nowMinute / 1440) * 100}%` }}
          aria-hidden="true"
        />
        {enabled ? (
          <span
            className="tnum absolute top-1/2 -translate-x-[calc(100%+4px)] -translate-y-1/2 rounded-md bg-surface px-1.5 text-[10.5px] font-extrabold whitespace-nowrap text-muted"
            style={{ left: `${(toMinutes(from) / 1440) * 100}%` }}
          >
            {formatClock(from)}
          </span>
        ) : null}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] font-extrabold text-muted">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span key={hour}>{formatHour(hour)}</span>
        ))}
      </div>
    </div>
  );
}
