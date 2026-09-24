import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/shared/lib/telegram';
import { Button, Sheet, toast } from '@/shared/ui';
import { useDeleteAllData } from '../hooks';

/** What the user must type, letter for letter (the request body carries it). */
export const DELETE_WORD = 'DELETE';

interface DeleteAllDataSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The last step before DELETE /data: what goes, what stays, and a field
 * that has to read DELETE before the button works. Afterwards every cache
 * is reset and Today opens empty.
 */
export function DeleteAllDataSheet({ open, onClose }: DeleteAllDataSheetProps) {
  const navigate = useNavigate();
  const haptic = useHapticFeedback();
  const remove = useDeleteAllData();
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped('');
  }
  const confirmed = typed.trim() === DELETE_WORD;

  const run = () => {
    if (!confirmed || remove.isPending) return;
    haptic.notify('warning');
    remove.mutate(undefined, {
      onSuccess: (result) => {
        onClose();
        toast({
          message: `Deleted ${result.deletedTasks} ${result.deletedTasks === 1 ? 'task' : 'tasks'}. Remy starts fresh.`,
        });
        navigate('/', { replace: true });
      },
      onError: () => {
        haptic.notify('error');
        toast({ message: "Couldn't delete your data. Nothing was removed; try again.", tone: 'danger' });
      },
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Delete all data"
      footer={
        <Button variant="danger" block disabled={!confirmed || remove.isPending} onClick={run}>
          {remove.isPending ? 'Deleting…' : 'Delete everything'}
        </Button>
      }
    >
      <p className="flex items-start gap-2 text-[13.5px] font-semibold text-text">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-danger" />
        <span>
          Every reminder and todo, done or not, your categories, what Remy remembers from the chat, and the calendar
          link are deleted for good. Settings go back to the defaults. Your account stays, so the bot keeps answering.
        </span>
      </p>
      <p className="mt-3 text-[13.5px] font-semibold text-muted">
        There is no undo. Export first if you might want any of it back.
      </p>
      <label className="mt-4 block">
        <span className="mb-2 block text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">
          Type {DELETE_WORD} to confirm
        </span>
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={DELETE_WORD}
          aria-label={`Type ${DELETE_WORD} to confirm`}
          className="min-h-12 w-full rounded-xl border border-rule bg-past px-3 text-[16px] font-bold tracking-wide text-text outline-none placeholder:font-semibold placeholder:text-faint"
        />
      </label>
    </Sheet>
  );
}
