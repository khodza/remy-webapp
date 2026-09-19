import { cx } from '@/shared/ui';

export interface StripTick {
  id: string;
  minute: number;
  tone: 'accent' | 'danger' | 'muted' | 'ok';
}

interface LoadStripProps {
  ticks: StripTick[];
  /** The task this strip is about: drawn larger. */
  highlight?: string;
  nowMinute?: number | null;
  label: string;
}

const FROM = 6 * 60;
const SPAN = 18 * 60;
const pct = (minute: number) => `${Math.min(100, Math.max(0, ((minute - FROM) / SPAN) * 100))}%`;

const TONES: Record<StripTick['tone'], string> = {
  accent: 'bg-accent',
  danger: 'bg-danger',
  muted: 'bg-faint',
  ok: 'bg-ok',
};

/** 06:00–24:00 at a glance: where the day's reminders sit, and now. */
export function LoadStrip({ ticks, highlight, nowMinute = null, label }: LoadStripProps) {
  return (
    <div className="px-4" aria-label={`${label}: ${ticks.length} reminders`}>
      <div className="relative h-7 overflow-hidden rounded-lg bg-past">
        {nowMinute !== null ? (
          <>
            <div className="absolute inset-y-0 left-0 bg-rule/60" style={{ width: pct(nowMinute) }} aria-hidden="true" />
            <div className="absolute inset-y-0 border-l-2 border-dashed border-now" style={{ left: pct(nowMinute) }} aria-hidden="true" />
          </>
        ) : null}
        {ticks.map((tick) => (
          <i
            key={tick.id}
            aria-hidden="true"
            className={cx('absolute rounded-sm', TONES[tick.tone], tick.id === highlight ? 'inset-y-1 w-2 -translate-x-1 ring-2 ring-surface' : 'inset-y-2 w-1 -translate-x-0.5 opacity-70')}
            style={{ left: pct(tick.minute) }}
          />
        ))}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] font-extrabold text-muted">
        <span>06:00</span>
        <span>{label}</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
