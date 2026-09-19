import { closingBehavior } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

let holders = 0;

/**
 * While `active`, closing the Mini App asks "Changes you made may not be
 * saved". Counted, so two dirty fields don't switch it off for each other.
 */
export function useClosingConfirmation(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    if (!closingBehavior.isMounted() && closingBehavior.mount.isAvailable()) closingBehavior.mount();
    holders += 1;
    closingBehavior.enableConfirmation.ifAvailable();
    return () => {
      holders -= 1;
      if (holders === 0) closingBehavior.disableConfirmation.ifAvailable();
    };
  }, [active]);
}
