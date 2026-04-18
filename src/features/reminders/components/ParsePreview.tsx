import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import type { ParsedTask } from '@/shared/api';

interface ParsePreviewProps {
  parsed: ParsedTask | null;
  loading: boolean;
  error?: string | undefined;
}

export function ParsePreview({ parsed, loading, error }: ParsePreviewProps) {
  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-3">
        <p className="font-sans text-xs text-[color:var(--color-danger)]">
          Couldn't parse: {error}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
        <Sparkles
          size={14}
          className="animate-pulse text-[color:var(--color-accent)]"
        />
        <span className="font-sans text-xs text-[color:var(--color-text-2)]">
          Parsing…
        </span>
      </div>
    );
  }

  if (!parsed) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles size={12} className="text-[color:var(--color-accent)]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          Preview
        </span>
      </div>
      <p className="font-sans text-[15px] leading-snug tracking-tight text-[color:var(--color-text)]">
        {parsed.description}
      </p>
      <p className="mt-1 font-sans text-xs tabular-nums text-[color:var(--color-accent)]">
        {format(parsed.scheduledAt, 'EEE, MMM d · h:mm a')}
      </p>
    </div>
  );
}
