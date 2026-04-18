import { hapticFeedback } from '@telegram-apps/sdk-react';
import { useCallback } from 'react';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

export function useHapticFeedback() {
  const impact = useCallback((style: ImpactStyle = 'light') => {
    if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred(style);
    }
  }, []);

  const notify = useCallback((type: NotificationType) => {
    if (hapticFeedback.notificationOccurred.isAvailable()) {
      hapticFeedback.notificationOccurred(type);
    }
  }, []);

  const selection = useCallback(() => {
    if (hapticFeedback.selectionChanged.isAvailable()) {
      hapticFeedback.selectionChanged();
    }
  }, []);

  return { impact, notify, selection };
}
