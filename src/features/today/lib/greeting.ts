import { inTz } from '@/shared/lib/dates';

/** The part of the day in the user's zone, for the Today greeting. */
export function partOfDay(now: Date, tz: string): 'night' | 'morning' | 'afternoon' | 'evening' {
  const hour = inTz(now, tz).getHours();
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** "Good morning, Ada" (or without a name); late at night "Still up, Ada?". */
export function greeting(now: Date, tz: string, firstName?: string | null): string {
  const name = firstName?.trim() || null;
  const part = partOfDay(now, tz);
  if (part === 'night') return name ? `Still up, ${name}?` : 'Still up?';
  const hello = `Good ${part}`;
  return name ? `${hello}, ${name}` : hello;
}
