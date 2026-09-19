import { quietSegments, toMinutes } from '../lib/nudges';

/** 00:00–24:00 with the quiet window shaded and now marked. */
export function QuietBar({ from, to, enabled, nowMinute }: { from: string; to: string; enabled: boolean; nowMinute: number }) {
  return (
    <div className="px-4" aria-label={enabled ? `Quiet from ${from} to ${to}` : 'Quiet hours off'}>
      <div className="relative h-8 overflow-hidden rounded-lg bg-accent-soft">
        {enabled
          ? quietSegments(from, to).map(([left, width]) => (
              <i key={left} className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_2px,transparent_2px_7px)] opacity-35" style={{ left: `${left}%`, width: `${width}%` }} />
            ))
          : null}
        <i className="absolute inset-y-0 border-l-2 border-now" style={{ left: `${(nowMinute / 1440) * 100}%` }} aria-hidden="true" />
        {enabled ? (
          <span className="tnum absolute top-1/2 -translate-y-1/2 rounded-md bg-surface px-1.5 text-[10.5px] font-extrabold text-muted" style={{ left: `calc(${(toMinutes(from) / 1440) * 100}% - 40px)` }}>
            {from}
          </span>
        ) : null}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] font-extrabold text-muted">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
