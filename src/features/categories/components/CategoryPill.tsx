import type { Category } from '@/shared/api';
import { Pill } from '@/shared/ui';

/** Neutral meta pill with the category's colour as a dot. */
export function CategoryPill({ category }: { category: Category }) {
  return (
    <Pill>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: category.color }} />
      {category.name}
    </Pill>
  );
}
