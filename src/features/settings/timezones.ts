export interface TimezoneOption {
  value: string;
  label: string;
}

/**
 * Common IANA timezones. Same shortlist the bot's /settings keyboard offers,
 * plus a few extras. Order is rough geography (west → east).
 */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
  { value: 'America/Denver', label: 'Denver' },
  { value: 'America/Chicago', label: 'Chicago' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Istanbul', label: 'Istanbul' },
  { value: 'Africa/Cairo', label: 'Cairo' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Tashkent', label: 'Tashkent' },
  { value: 'Asia/Kolkata', label: 'Kolkata' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export function timeInZone(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return '—';
  }
}
