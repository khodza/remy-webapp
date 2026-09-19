import type { PropsWithChildren } from 'react';
import { cx } from './cx';

type Tone = 'neutral' | 'accent' | 'danger' | 'ok' | 'warn';

const TONES: Record<Tone, string> = {
  neutral: 'bg-past text-muted',
  accent: 'bg-accent-soft text-accent',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
};

/** Small meta label: category, repeat, "snoozed". */
export function Pill({ tone = 'neutral', children, className }: PropsWithChildren<{ tone?: Tone; className?: string }>) {
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 truncate rounded-full px-[7px] py-[2px] text-[11px] font-extrabold', TONES[tone], className)}>
      {children}
    </span>
  );
}
