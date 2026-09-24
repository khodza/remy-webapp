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

/**
 * Small meta label: category, repeat, "snoozed". A block, not a flex row:
 * `text-overflow` does nothing for text sitting directly in a flex container.
 */
export function Pill({
  tone = 'neutral',
  children,
  className,
}: PropsWithChildren<{ tone?: Tone; className?: string }>) {
  return (
    <span
      className={cx(
        'inline-block max-w-full truncate rounded-full px-[7px] py-[2px] align-middle text-[11px] font-extrabold [&>*]:mr-1 [&>*]:inline-block [&>span]:align-middle [&>svg]:align-[-1.5px]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
