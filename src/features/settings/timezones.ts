import { getDeviceTimezone } from '@/shared/lib/dates';

/** Fallback shortlist for engines without Intl.supportedValuesOf. */
const FALLBACK_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Tashkent',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/** Every IANA zone the runtime knows, always including the device zone. */
export function listTimezones(): string[] {
  let zones: string[];
  try {
    zones =
      typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }
  const device = getDeviceTimezone();
  const set = new Set(zones);
  set.add('UTC');
  set.add(device);
  return [...set].sort();
}

/** "America/New_York" → "New York" */
export function zoneCity(zone: string): string {
  const last = zone.split('/').pop() ?? zone;
  return last.replace(/_/g, ' ');
}

/** "America/New_York" → "America" (empty for "UTC") */
export function zoneRegion(zone: string): string {
  const parts = zone.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join(' / ') : '';
}

/** Case-insensitive substring match on the id, the city, and the region. */
export function matchesZone(zone: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${zone} ${zoneCity(zone)} ${zoneRegion(zone)}`.toLowerCase();
  return hay.replace(/_/g, ' ').includes(q.replace(/_/g, ' '));
}
