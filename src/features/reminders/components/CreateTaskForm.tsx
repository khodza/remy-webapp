import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/shared/api';
import { useMainButton, useHapticFeedback } from '@/shared/lib/telegram';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useCreateTask } from '../hooks';
import { ParsePreview } from './ParsePreview';

const MIN_PARSE_LENGTH = 4;

export function CreateTaskForm() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text.trim(), 500);
  const createTask = useCreateTask();
  const haptic = useHapticFeedback();

  const parseQuery = useQuery({
    queryKey: ['parse', debounced],
    queryFn: () => api.parseText(debounced),
    enabled: debounced.length >= MIN_PARSE_LENGTH,
    staleTime: 60_000,
    retry: 0,
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useMainButton({
    text: createTask.isPending ? 'Creating…' : 'Create reminder',
    enabled: text.trim().length > 0 && !createTask.isPending,
    loading: createTask.isPending,
    onClick: () => {
      const trimmed = text.trim();
      if (!trimmed) return;
      haptic.impact('medium');
      createTask.mutate(trimmed, {
        onSuccess: () => {
          haptic.notify('success');
          navigate('/', { replace: true });
        },
        onError: () => {
          haptic.notify('error');
        },
      });
    },
  });

  const parseError =
    parseQuery.isError && parseQuery.error instanceof Error
      ? parseQuery.error.message
      : undefined;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          What should Remy remind you about?
        </span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="e.g. call mom tomorrow at 6pm"
          className="resize-none rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 font-sans text-[15px] leading-snug tracking-tight text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-3)] focus:border-[color:var(--color-accent)] focus:outline-none"
          onBlur={() => window.scrollTo(0, 0)}
        />
      </label>

      <ParsePreview
        parsed={parseQuery.data ?? null}
        loading={parseQuery.isFetching}
        error={parseError}
      />

      {createTask.isError && (
        <div className="rounded-[var(--radius-card)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-3">
          <p className="font-sans text-xs text-[color:var(--color-danger)]">
            {createTask.error instanceof Error
              ? createTask.error.message
              : 'Failed to create task.'}
          </p>
        </div>
      )}
    </div>
  );
}
