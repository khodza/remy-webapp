import { ChevronRight, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '@/features/profile';
import { zoneCity } from '@/features/settings';
import { getDeviceTimezone } from '@/shared/lib/dates';
import { Page } from '@/shared/ui';

export function SettingsPage() {
  const navigate = useNavigate();
  const me = useMe();
  const tz = me.data?.timezone ?? null;
  const detected = tz !== null && tz === getDeviceTimezone();

  return (
    <Page>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Settings
          </h1>
        </header>

        {me.data && (
          <section className="flex items-center gap-3 rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-sans text-lg font-semibold text-white"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-accent) 0%, oklch(60% 0.12 320) 100%)',
              }}
            >
              {me.data.firstName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-sans text-[17px] font-semibold tracking-tight text-[color:var(--color-text)]">
                {me.data.firstName}
                {me.data.lastName ? ` ${me.data.lastName}` : ''}
              </p>
              {me.data.username && (
                <p className="mt-0.5 truncate font-mono text-xs text-[color:var(--color-text-2)]">
                  @{me.data.username}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-[var(--radius-big)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <button
            type="button"
            onClick={() => navigate('/settings/timezone')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--color-surface-2)]"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: 'var(--color-accent-soft)',
                color: 'var(--color-accent)',
              }}
            >
              <Globe size={16} />
            </span>
            <span className="flex-1 font-sans text-[15px] font-medium text-[color:var(--color-text)]">
              Timezone
            </span>
            <span className="text-right">
              <span className="block font-sans text-xs text-[color:var(--color-text-2)]">
                {tz ? zoneCity(tz) : 'Detecting…'}
              </span>
              {detected && (
                <span className="block font-sans text-[10px] text-[color:var(--color-text-3)]">
                  detected
                </span>
              )}
            </span>
            <ChevronRight
              size={16}
              className="text-[color:var(--color-text-3)]"
            />
          </button>
        </section>
      </main>
    </Page>
  );
}
