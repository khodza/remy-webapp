import { Settings2 } from 'lucide-react';
import type { Category } from '@/shared/api';
import { Sheet, SheetOption } from '@/shared/ui';

interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  value: string | null;
  onPick: (id: string | null) => void;
  onManage?: () => void;
}

export function CategorySheet({ open, onClose, categories, value, onPick, onManage }: CategorySheetProps) {
  const pick = (id: string | null) => {
    onPick(id);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Category">
      <div className="-mx-1">
        <SheetOption
          label="None"
          selected={value === null}
          onClick={() => pick(null)}
          icon={<span className="h-2.5 w-2.5 rounded-full border-2 border-faint" />}
        />
        {categories.map((category) => (
          <SheetOption
            key={category.id}
            label={`${category.emoji} ${category.name}`}
            selected={value === category.id}
            onClick={() => pick(category.id)}
            icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />}
          />
        ))}
        {onManage ? (
          <SheetOption
            label="Edit categories"
            onClick={() => {
              onClose();
              onManage();
            }}
            icon={<Settings2 size={16} className="text-muted" />}
          />
        ) : null}
      </div>
    </Sheet>
  );
}
