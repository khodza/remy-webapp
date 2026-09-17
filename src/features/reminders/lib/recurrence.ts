import type { Recurrence } from '@/shared/api';

/** Short human label for a recurrence, or null for one-shot tasks. */
export function recurrenceLabel(
  recurrence: Recurrence | null | undefined,
): string | null {
  if (!recurrence) return null;
  switch (recurrence.type) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'every_n_days':
      return `Every ${recurrence.intervalDays ?? 1}d`;
  }
}
