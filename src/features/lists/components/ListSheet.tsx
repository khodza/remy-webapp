import { List, ListX } from 'lucide-react';
import { useState } from 'react';
import { Button, Sheet, SheetOption } from '@/shared/ui';
import { useLists } from '../hooks';
import { listTitle, normaliseListName } from '../lib/list-name';

interface ListSheetProps {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onPick: (list: string | null) => void;
}

/**
 * Which list a task is on: the existing ones from GET /lists, or a new
 * name typed in. The server normalises the name ("My Shopping List" →
 * "shopping"); the preview under the field shows what it will become.
 */
export function ListSheet({ open, onClose, value, onPick }: ListSheetProps) {
  const lists = useLists();
  const [input, setInput] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setInput('');
  }
  const typed = normaliseListName(input);
  const known = lists.data ?? [];
  const pick = (list: string | null) => {
    onPick(list);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="List"
      footer={
        <Button variant="primary" block disabled={!typed} onClick={() => typed && pick(typed)}>
          {typed ? `Put it on “${listTitle(typed)}”` : 'Type a list name'}
        </Button>
      }
    >
      <div className="-mx-1">
        <SheetOption
          label="No list"
          icon={<ListX size={17} className="text-muted" />}
          selected={value === null}
          onClick={() => pick(null)}
        />
        {known.map((list) => (
          <SheetOption
            key={list.name}
            label={listTitle(list.name)}
            detail={`${list.pending} open${list.completed ? ` · ${list.completed} done` : ''}`}
            icon={<List size={17} className="text-muted" />}
            selected={value === list.name}
            onClick={() => pick(list.name)}
          />
        ))}
        {value && !known.some((l) => l.name === value) ? (
          <SheetOption
            label={listTitle(value)}
            icon={<List size={17} className="text-muted" />}
            selected
            onClick={onClose}
          />
        ) : null}
      </div>
      <p className="mb-2 mt-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">New list</p>
      <input
        type="text"
        aria-label="New list"
        value={input}
        maxLength={40}
        placeholder="shopping"
        onChange={(event) => setInput(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-rule bg-past px-3 text-[16px] font-bold text-text outline-none placeholder:font-semibold placeholder:text-faint"
      />
      <p className="mt-2 text-[12.5px] font-semibold text-muted">
        Say “add eggs to the shopping list” to the bot and it lands here too.
      </p>
    </Sheet>
  );
}
