import type { Task } from '@/shared/api';
import { formatWhen, useUserTimezone } from '@/shared/lib/dates';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { toast } from '@/shared/ui';
import { useCompleteTask, useDelayTask, useReopenTask, useSnoozeTask } from './hooks';

/**
 * The one-tap actions every list shares (Today, Week, Search, Catch-up):
 * haptics, the mutation, and a toast that says what happened.
 */
export function useTaskActions() {
  const tz = useUserTimezone();
  const haptic = useHapticFeedback();
  const completeMutation = useCompleteTask();
  const reopenMutation = useReopenTask();
  const delayMutation = useDelayTask();
  const snoozeMutation = useSnoozeTask();

  const failed = (what: string) => () => {
    haptic.notify('error');
    toast({ message: `Couldn't ${what}. Try again.`, tone: 'danger' });
  };

  const complete = (task: Task) => {
    haptic.notify('success');
    const done = completeMutation.mutateAsync(task.id);
    if (task.recurrence) {
      // A repeating task moves to its next time; there is nothing to reopen.
      done.then(
        (updated) => {
          const next = updated.status === 'pending' ? (updated.nextFireAt ?? updated.scheduledAt) : null;
          toast({ message: next ? `Done. Next: ${formatWhen(next, tz)}` : 'Done. That was the last one.' });
        },
        failed('mark it done'),
      );
      return;
    }
    done.catch(failed('mark it done'));
    toast({
      message: `Done: ${task.description}`,
      // Undo waits for Done to land, or the reopen would arrive first.
      action: { label: 'Undo', onClick: () => void done.then(() => reopenMutation.mutate(task.id)).catch(() => undefined) },
    });
  };

  const reopen = (task: Task) => {
    haptic.impact('light');
    reopenMutation.mutate(task.id, { onError: failed('reopen it') });
  };

  /** Minutes from now (or from the due time, if that is later). */
  const delay = (task: Task, minutes: number) => {
    haptic.impact('light');
    delayMutation.mutate(
      { id: task.id, minutes },
      {
        onSuccess: (updated) => {
          const at = updated.nextFireAt ?? updated.scheduledAt;
          if (at) toast({ message: `Moved to ${formatWhen(at, tz)}` });
        },
        onError: failed('snooze it'),
      },
    );
  };

  const snoozeUntil = (task: Task, until: Date) => {
    haptic.impact('light');
    snoozeMutation.mutate(
      { id: task.id, until },
      { onSuccess: () => toast({ message: `Moved to ${formatWhen(until, tz)}` }), onError: failed('snooze it') },
    );
  };

  return { complete, reopen, delay, snoozeUntil };
}
