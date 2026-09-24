import { Check, Loader2, LocateFixed, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMe, useUpdateTimezone } from '@/features/profile';
import { listTimezones, matchesZone, zoneCity, zoneRegion } from '@/features/settings';
import { formatTime, getDeviceTimezone, utcOffsetLabel } from '@/shared/lib/dates';
import { useGoBack, useHapticFeedback } from '@/shared/lib/telegram';
import { useNow } from '@/shared/lib/useNow';
import { Group, Screen, SectionHeader, toast } from '@/shared/ui';

const MAX_ROWS = 80;

export function TimezonePage() {
  const goBack = useGoBack();
  const me = useMe();
  const update = useUpdateTimezone();
  const haptic = useHapticFeedback();
  const now = useNow();
  const [query, setQuery] = useState('');

  const currentTz = me.data?.timezone ?? null;
  const deviceTz = useMemo(() => getDeviceTimezone(), []);
  const allZones = useMemo(() => listTimezones(), []);
  const zones = useMemo(() => {
    const filtered = allZones.filter((z) => matchesZone(z, query));
    // Keep the current zone visible at the top when it matches.
    if (currentTz && filtered.includes(currentTz)) return [currentTz, ...filtered.filter((z) => z !== currentTz)];
    return filtered;
  }, [allZones, query, currentTz]);
  const visible = zones.slice(0, MAX_ROWS);

  const select = (tz: string) => {
    if (tz === currentTz) {
      goBack();
      return;
    }
    haptic.selection();
    update.mutate(tz, {
      onSuccess: () => {
        haptic.notify('success');
        toast({ message: `Time zone: ${zoneCity(tz)}` });
        goBack();
      },
      onError: () => {
        haptic.notify('error');
        toast({ message: "Couldn't change the time zone. Try again.", tone: 'danger' });
      },
    });
  };

  const row = (zone: string, label: string, detail: string, icon?: React.ReactNode) => (
    <button
      key={zone + label}
      type="button"
      onClick={() => select(zone)}
      disabled={update.isPending}
      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left active:bg-past disabled:opacity-60"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-extrabold">{label}</span>
        {detail ? <span className="block truncate text-[12px] font-semibold text-muted">{detail}</span> : null}
      </span>
      <span className="tnum text-right">
        <span className="block text-[13px] font-extrabold">{formatTime(now, zone)}</span>
        <span className="block text-[10.5px] font-bold text-muted">UTC{utcOffsetLabel(zone, now)}</span>
      </span>
      <span className="flex w-5 justify-center">
        {update.isPending && update.variables === zone ? (
          <Loader2 size={16} className="animate-spin text-accent" />
        ) : zone === currentTz ? (
          <Check size={16} className="text-accent" />
        ) : null}
      </span>
    </button>
  );

  return (
    <Screen>
      <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Time zone</h1>
      <p className="px-4 pb-3 text-[13px] font-semibold text-muted">
        Remy uses it to understand “tomorrow at 6” and to show every time in your hours.
      </p>

      <Group>
        {row(
          deviceTz,
          `Auto: ${zoneCity(deviceTz)}`,
          `${deviceTz} · from this device`,
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-accent-soft text-accent">
            <LocateFixed size={16} />
          </span>,
        )}
      </Group>

      <div className="px-3 pt-4">
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-rule bg-surface px-3">
          <Search size={16} className="text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a city or zone"
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-text outline-none placeholder:font-semibold placeholder:text-faint"
          />
        </label>
      </div>

      <SectionHeader label={query ? `${zones.length} matches` : 'All zones'} />
      <Group>
        {visible.length === 0 ? (
          <p className="px-3.5 py-4 text-[13.5px] font-semibold text-muted">No zone matches “{query}”.</p>
        ) : null}
        {visible.map((zone) => row(zone, zoneCity(zone), zoneRegion(zone) ?? ''))}
      </Group>
      {zones.length > MAX_ROWS ? (
        <p className="px-4 pt-2 text-[12px] font-semibold text-muted">
          Showing {MAX_ROWS} of {zones.length}. Keep typing to narrow it down.
        </p>
      ) : null}
    </Screen>
  );
}
