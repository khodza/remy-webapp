import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/features/categories';
import type { Category } from '@/shared/api';
import { ApiError } from '@/shared/api';
import { Button, cx, Empty, Group, Screen, Sheet, SkeletonRows, toast } from '@/shared/ui';

const COLORS = ['#5B5BD6', '#12B76A', '#F04438', '#F79009', '#0E9F9E', '#7A5AF8', '#EE46BC', '#667085'];
const EMOJIS = ['💼', '🏠', '🩺', '🛒', '🙂', '📚', '💰', '✈️', '🏋️', '🎉', '🧾', '🐾'];

interface Form {
  name: string;
  emoji: string;
  color: string;
  keywords: string;
}

const blank: Form = { name: '', emoji: '📌', color: COLORS[0] ?? '#5B5BD6', keywords: '' };
const toForm = (c: Category): Form => ({ name: c.name, emoji: c.emoji, color: c.color, keywords: c.keywords.join(', ') });
const keywordList = (text: string) =>
  [...new Set(text.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 20).map((k) => k.slice(0, 32));

/** Names, emoji and colours for categories, plus the words that suggest them. */
export function CategoriesPage() {
  const categories = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank);

  const open = (target: Category | 'new') => {
    setForm(target === 'new' ? blank : toForm(target));
    setEditing(target);
  };
  const failed = (err: unknown) => toast({ message: err instanceof ApiError ? err.message : "Couldn't save. Try again.", tone: 'danger' });

  const submit = () => {
    const body = { name: form.name.trim().slice(0, 24), emoji: form.emoji.trim() || '📌', color: form.color, keywords: keywordList(form.keywords) };
    if (!body.name) return;
    if (editing === 'new') create.mutate(body, { onSuccess: () => setEditing(null), onError: failed });
    else if (editing) update.mutate({ id: editing.id, patch: body }, { onSuccess: () => setEditing(null), onError: failed });
  };

  return (
    <Screen>
      <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Categories</h1>
      <p className="px-4 pb-3 text-[13px] font-semibold text-muted">Remy suggests a category when your words match one of its keywords, or when you add #name.</p>

      {categories.isPending ? (
        <SkeletonRows count={4} />
      ) : (categories.data ?? []).length === 0 ? (
        <Empty title="No categories yet" body="Add one to group reminders and colour the timeline." />
      ) : (
        <Group>
          {(categories.data ?? []).map((category) => (
            <button key={category.id} type="button" onClick={() => open(category)} className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left active:bg-past">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[18px]" style={{ background: `color-mix(in oklab, ${category.color} 16%, transparent)` }}>
                {category.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[14.5px] font-extrabold">
                  <i className="h-2 w-2 rounded-full" style={{ background: category.color }} />
                  {category.name}
                </span>
                <span className="block truncate text-[12px] font-semibold text-muted">{category.keywords.length ? category.keywords.join(', ') : 'No keywords'}</span>
              </span>
            </button>
          ))}
        </Group>
      )}

      <Group className="mt-3">
        <button type="button" onClick={() => open('new')} className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 text-left text-[14.5px] font-extrabold text-accent active:bg-past">
          <Plus size={18} /> New category
        </button>
      </Group>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New category' : 'Edit category'}
        footer={
          <>
            {editing && editing !== 'new' ? (
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  const target = editing;
                  remove.mutate(target.id, {
                    onSuccess: () => toast({ message: `Deleted ${target.name}. Its reminders keep going, uncategorised.` }),
                    onError: failed,
                  });
                  setEditing(null);
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button variant="primary" block disabled={!form.name.trim() || create.isPending || update.isPending} onClick={submit}>
              {editing === 'new' ? 'Add category' : 'Save'}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">Name</span>
          <input
            value={form.name}
            maxLength={24}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-rule bg-past px-3 text-[16px] font-bold text-text outline-none"
          />
        </label>

        <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">Emoji</p>
        <div className="mt-1.5 grid grid-cols-6 gap-1.5">
          {[...new Set([form.emoji, ...EMOJIS])].slice(0, 12).map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={form.emoji === emoji}
              onClick={() => setForm({ ...form, emoji })}
              className={cx('flex h-11 items-center justify-center rounded-xl text-[20px]', form.emoji === emoji ? 'bg-accent-soft ring-2 ring-accent' : 'bg-past')}
            >
              {emoji}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">Colour</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Colour ${color}`}
              aria-pressed={form.color.toLowerCase() === color.toLowerCase()}
              onClick={() => setForm({ ...form, color })}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span className={cx('h-8 w-8 rounded-full', form.color.toLowerCase() === color.toLowerCase() && 'ring-2 ring-text ring-offset-2 ring-offset-surface')} style={{ background: color }} />
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">Keywords</span>
          <input
            value={form.keywords}
            placeholder="dentist, gym, vitamins"
            onChange={(event) => setForm({ ...form, keywords: event.target.value })}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-rule bg-past px-3 text-[15px] font-semibold text-text outline-none placeholder:text-faint"
          />
          <span className="mt-1 block text-[12px] font-semibold text-muted">Comma-separated. “dentist” makes “call the dentist” land here.</span>
        </label>
      </Sheet>
    </Screen>
  );
}
