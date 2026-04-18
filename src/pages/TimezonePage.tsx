import { Check, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useUpdateTimezone } from '@/features/profile';
import {
  TIMEZONE_OPTIONS,
  timeInZone,
} from '@/features/settings/timezones';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { Page } from '@/shared/ui';

export function TimezonePage() {
  const navigate = useNavigate();
  const me = useMe();
  const update = useUpdateTimezone();
  const haptic = useHapticFeedback();

  // Force a minute-by-minute re-render so per-zone clocks update.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentTz = me.data?.timezone;
  const options = useMemo(() => TIMEZONE_OPTIONS, []);

  const handleSelect = (tz: string) => {
    if (tz === currentTz) {
      navigate(-1);
      return;
    }
    haptic.selection();
    update.mutate(tz, {
      onSuccess: () => {
        haptic.notify('success');
        navigate(-1);
      },
      onError: () => haptic.notify('error'),
    });
  };

  return (
    <Page>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Timezone
          </h1>
          <p className="mt-1 font-sans text-sm text-[color:var(--color-text-2)]">
            Remy uses this to interpret "tomorrow 6pm" correctly.
          </p>
        </header>

        <ul className="overflow-hidden rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          {options.map((opt, idx) => {
            const isCurrent = opt.value === currentTz;
            const isLast = idx === options.length - 1;
            return (
              <li
                key={opt.value}
                className={`border-[color:var(--color-hairline)] ${isLast ? '' : 'border-b'}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  disabled={update.isPending}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--color-surface-2)] disabled:opacity-60"
                >
                  <span className="flex-1 font-sans text-[15px] font-medium text-[color:var(--color-text)]">
                    {opt.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[color:var(--color-text-2)]">
                    {timeInZone(opt.value, now)}
                  </span>
                  {isCurrent && !update.isPending && (
                    <Check
                      size={16}
                      className="text-[color:var(--color-accent)]"
                    />
                  )}
                  {update.isPending && update.variables === opt.value && (
                    <Loader2
                      size={16}
                      className="animate-spin text-[color:var(--color-accent)]"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {update.isError && (
          <div className="rounded-[var(--radius-card)] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] p-3">
            <p className="font-sans text-xs text-[color:var(--color-danger)]">
              {update.error instanceof Error
                ? update.error.message
                : 'Failed to update timezone.'}
            </p>
          </div>
        )}
      </main>
    </Page>
  );
}
