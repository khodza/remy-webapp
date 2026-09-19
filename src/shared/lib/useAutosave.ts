import { useEffect, useRef, useState } from 'react';
import { useClosingConfirmation } from './telegram';

/**
 * A text field that saves itself: on blur, and when the screen goes away
 * (Telegram's Back doesn't blur the input first). Closing the app while
 * it has unsaved text asks for confirmation.
 */
export function useAutosave(saved: string, save: (value: string) => void) {
  const [value, setValue] = useState(saved);
  const latest = useRef({ value, saved, save });
  latest.current = { value, saved, save };

  // A newer server copy replaces the text unless the user is mid-edit.
  const [base, setBase] = useState(saved);
  if (saved !== base) {
    setBase(saved);
    if (value === base) setValue(saved);
  }

  const commit = () => {
    const { value: current, saved: persisted, save: persist } = latest.current;
    if (current !== persisted) persist(current);
  };

  // Unmount only; commit reads the latest values from the ref.
  useEffect(() => () => commit(), []);
  useClosingConfirmation(value !== saved);

  return { value, setValue, commit };
}
