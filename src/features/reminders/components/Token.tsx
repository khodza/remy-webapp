import type { ReactNode } from 'react';
import { cx } from '@/shared/ui';

type Tone = 'accent' | 'confirm' | 'plain' | 'add';

const TONES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  confirm: 'bg-warn-soft text-warn ring-1 ring-warn/40',
  plain: 'bg-surface text-text border border-rule',
  add: 'border border-dashed border-rule text-muted',
};

/** One thing Remy understood ("Thu 18 Sep", "17:00?", "↻ every Thu"); tap to change it. */
export function Token({ tone = 'accent', onClick, children, label }: { tone?: Tone; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx('tnum inline-flex min-h-9 max-w-full items-center gap-1 truncate rounded-xl px-2.5 text-[13.5px] font-extrabold transition active:scale-[0.97]', TONES[tone])}
    >
      {children}
    </button>
  );
}
