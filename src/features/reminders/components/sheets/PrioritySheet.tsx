import type { Priority } from '@/shared/api';
import { Sheet, SheetOption } from '@/shared/ui';

const OPTIONS: Array<{ value: Priority; label: string; detail: string }> = [
  { value: 'low', label: 'Low', detail: 'One ping, never nudged again' },
  { value: 'normal', label: 'Normal', detail: 'Nudged again if you ignore it' },
  { value: 'high', label: 'High', detail: 'Flagged, nudged harder, can break quiet hours' },
];

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High' };

export function PrioritySheet({
  open,
  onClose,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  value: Priority;
  onPick: (value: Priority) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Priority">
      <div className="-mx-1">
        {OPTIONS.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            detail={option.detail}
            selected={value === option.value}
            onClick={() => {
              onPick(option.value);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}
