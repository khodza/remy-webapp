import { Check, Loader2, LocateFixed, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useUpdateTimezone } from '@/features/profile';
import {
  listTimezones,
  matchesZone,
  zoneCity,
  zoneRegion,
} from '@/features/settings';
import {
  formatTime,
  getDeviceTimezone,
  utcOffsetLabel,
} from '@/shared/lib/dates';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { Page } from '@/shared/ui';

const MAX_ROWS = 80;

export function TimezonePage() {
  const navigate = useNavigate();
  const me = useMe();
  const update = useUpdateTimezone();
  const haptic = useHapticFeedback();
  const [query, setQuery] = useState('');

  // Minute-by-minute re-render so per-zone clocks stay right.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentTz = me.data?.timezone ?? null;
  const deviceTz = useMemo(() => getDeviceTimezone(), []);
  const allZones = useMemo(() => listTimezones(), []);
  const zones = useMemo(() => {
    const filtered = allZones.filter((z) => matchesZone(z, query));
    // Keep the current zone visible at the top when it matches.
    if (currentTz && filtered.includes(currentTz)) {
      return [currentTz, ...filtered.filter((z) => z !== currentTz)];
    }
    return filtered;
  }, [allZones, query, currentTz]);
  const visible = zones.slice(0, MAX_ROWS);

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
            Time zone
          </h1>
          <p className="mt-1 font-sans text-sm text-[color:var(--color-text-2)]">
            Remy uses this to understand "tomorrow at 6" and to show every
            time in your local hours.
          </p>
        </header>

        <button
          type="button"
          onClick={() => handleSelect(deviceTz)}
          disabled={update.isPending}
          className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 text-left transition hover:bg-[color:var(--color-surface-2)] disabled:opacity-60"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
            }}
          >
            <LocateFixed size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-sans text-[15px] font-medium text-[color:var(--color-text)]">
              Auto: {zoneCity(deviceTz)}
            </span>
            <span className="block truncate font-sans text-xs text-[color:var(--color-text-2)]">
              {deviceTz} · detected from this device
            </span>
          </span>
          {currentTz === deviceTz && (
            <Check size={16} className="text-[color:var(--color-accent)]" />
          )}
        </button>

        <label className="flex items-center gap-2 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 focus-within:border-[color:var(--color-accent)]">
          <Search size={16} className="text-[color:var(--color-text-3)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or zone…"
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent font-sans text-[15px] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-3)] focus:outline-none"
          />
        </label>

        <ul className="overflow-hidden rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          {visible.length === 0 && (
            <li className="px-4 py-4 font-sans text-sm text-[color:var(--color-text-2)]">
              No zone matches “{query}”.
            </li>
          )}
          {visible.map((zone, idx) => {
            const isCurrent = zone === currentTz;
            const isLast = idx === visible.length - 1;
            const region = zoneRegion(zone);
            return (
              <li
                key={zone}
                className={`border-[color:var(--color-hairline)] ${isLast ? '' : 'border-b'}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(zone)}
                  disabled={update.isPending}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[color:var(--color-surface-2)] disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[15px] font-medium text-[color:var(--color-text)]">
                      {zoneCity(zone)}
                    </span>
                    {region && (
                      <span className="block truncate font-sans text-[11px] text-[color:var(--color-text-2)]">
                        {region}
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-xs tabular-nums text-[color:var(--color-text)]">
                      {formatTime(now, zone)}
                    </span>
                    <span className="block font-mono text-[10px] tabular-nums text-[color:var(--color-text-3)]">
                      UTC{utcOffsetLabel(zone, now)}
                    </span>
                  </span>
                  {isCurrent && !update.isPending && (
                    <Check
                      size={16}
                      className="text-[color:var(--color-accent)]"
                    />
                  )}
                  {update.isPending && update.variables === zone && (
                    <Loader2
                      size={16}
                      className="animate-spin text-[color:var(--color-accent)]"
                    />
                  )}
                </button>
              </li>
            );
          })}
          {zones.length > MAX_ROWS && (
            <li className="px-4 py-3 font-sans text-xs text-[color:var(--color-text-2)]">
              Showing {MAX_ROWS} of {zones.length}. Keep typing to narrow down.
            </li>
          )}
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
