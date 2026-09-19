import { Sheet, SheetOption } from '@/shared/ui';
import { LEAD_CHOICES, leadLabel } from '../../lib/when';

interface LeadSheetProps {
  open: boolean;
  onClose: () => void;
  value: number | null;
  onPick: (minutes: number | null) => void;
}

/** "Remind me before": a heads-up ping, then the reminder at its time. */
export function LeadSheet({ open, onClose, value, onPick }: LeadSheetProps) {
  const choices = value === null || LEAD_CHOICES.includes(value) ? LEAD_CHOICES : [...LEAD_CHOICES, value];
  return (
    <Sheet open={open} onClose={onClose} title="Remind me">
      <div className="-mx-1">
        {choices.map((minutes) => (
          <SheetOption
            key={minutes ?? 'none'}
            label={leadLabel(minutes)}
            detail={minutes === null ? 'One ping, on time' : 'A heads-up, then the reminder on time'}
            selected={value === minutes}
            onClick={() => {
              onPick(minutes);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}
