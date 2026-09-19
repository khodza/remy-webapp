import type { UpdateSettingsRequest } from '@/shared/api';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { toast } from '@/shared/ui';
import { useUpdateSettings } from './hooks';

/**
 * Every settings control saves on its own: a PATCH with only that nested
 * field. The hook is optimistic; a failure rolls back and says so.
 */
export function useSaveSettings() {
  const update = useUpdateSettings();
  const haptic = useHapticFeedback();
  return (patch: UpdateSettingsRequest) => {
    haptic.selection();
    update.mutate(patch, {
      onError: () => {
        haptic.notify('error');
        toast({ message: "Couldn't save that setting. Try again.", tone: 'danger' });
      },
    });
  };
}
