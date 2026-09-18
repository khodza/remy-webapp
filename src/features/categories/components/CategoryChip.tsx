import type { Category } from '@/shared/api';

interface CategoryChipProps {
  category: Category;
  /** Picker chips are taller and show a selected state. */
  selected?: boolean;
  size?: 'sm' | 'md';
}

/** Emoji + name in the category's colour (tinted background, solid text). */
export function CategoryChip({
  category,
  selected = false,
  size = 'sm',
}: CategoryChipProps) {
  const pad = size === 'md' ? 'px-3 py-1.5 text-[12px]' : 'px-2 py-[3px] text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border font-sans font-medium ${pad}`}
      style={{
        color: category.color,
        borderColor: selected ? category.color : 'transparent',
        backgroundColor: `color-mix(in oklab, ${category.color} 14%, transparent)`,
      }}
    >
      <span aria-hidden="true">{category.emoji}</span>
      {category.name}
    </span>
  );
}
