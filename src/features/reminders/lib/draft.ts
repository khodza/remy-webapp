import { addHours } from 'date-fns';
import type { Category, Task } from '@/shared/api';
import { inTz } from '@/shared/lib/dates';

/**
 * Client-side checks on what the parser understood. The parse response has
 * no confidence, so these rules decide what to show as "please confirm".
 */

const DAYPART = /\b(am|pm|a\.m\.?|p\.m\.?|morning|afternoon|evening|night|tonight|noon|midday|midnight|breakfast|lunch|dinner|утр|вечер|ночи|дня)\b/i;
// "at 5", "at 5:30", "5 o'clock"; not "5 min", "5 days", "17:00" or "5th".
const BARE_HOUR = /\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?(?:\s*o'?clock)?\b(?!\s*(?:[a-z]*(?:min|hour|day|week|month|year|h\b|st\b|nd\b|rd\b|th\b)|%|\/|-|\.\d))/gi;

/**
 * "call mom at 5": 05:00 or 17:00? Returns the other reading when the text
 * names a 12-hour clock time without a day part and the parse used one of
 * the two readings.
 */
export function ambiguousTime(text: string, parsedAt: Date, tz: string): Date | null {
  if (DAYPART.test(text)) return null;
  const local = inTz(parsedAt, tz);
  const hour = local.getHours();
  for (const match of text.matchAll(BARE_HOUR)) {
    // "at 5" or "5:30" only: a lone number could be anything ("buy 5 eggs").
    if (!/^at\s/i.test(match[0]) && match[2] === undefined) continue;
    const h = Number(match[1]) % 12;
    const m = match[2] === undefined ? 0 : Number(match[2]);
    if (local.getMinutes() !== m) continue;
    if (hour === h) return addHours(parsedAt, 12);
    if (hour === h + 12) return addHours(parsedAt, -12);
  }
  return null;
}

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}#]+/u)
    .filter(Boolean);

/** "#work" picks Work; otherwise a keyword ("dentist" → Health). */
export function suggestCategory(text: string, categories: Category[]): string | null {
  const tokens = words(text);
  for (const token of tokens) {
    if (!token.startsWith('#')) continue;
    const found = categories.find((c) => c.name.toLowerCase() === token.slice(1));
    if (found) return found.id;
  }
  const lower = text.toLowerCase();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const category of categories) {
    const hit = [category.name, ...category.keywords].some((keyword) => {
      const k = keyword.trim().toLowerCase();
      // Whole words (plural allowed): "dentists" yes, "moment" for "mom" no.
      return k.length > 1 && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(k)}(e?s)?(?=$|[^\\p{L}\\p{N}])`, 'u').test(lower);
    });
    if (hit) return category.id;
  }
  return null;
}

/** Drops "#work"-style tags that named a category from the title. */
export function stripCategoryTags(title: string, categories: Category[]): string {
  const names = new Set(categories.map((c) => c.name.toLowerCase()));
  return title
    .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (all, lead: string, tag: string) => (names.has(tag.toLowerCase()) ? lead : all))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const STOP = new Set(['the', 'a', 'an', 'to', 'at', 'on', 'in', 'for', 'and', 'my', 'me', 'of', 'with', 'remind', 'about']);
const keyWords = (text: string) => new Set(words(text).filter((w) => !STOP.has(w) && !w.startsWith('#') && !/^\d+$/.test(w)));

/** Pending tasks whose title shares most of its words with `title`. */
export function similarTasks(title: string, tasks: Task[], limit = 2): Task[] {
  const mine = keyWords(title);
  if (mine.size === 0) return [];
  return tasks
    .filter((t) => t.status === 'pending')
    .map((task) => {
      const theirs = keyWords(task.description);
      let shared = 0;
      for (const w of mine) if (theirs.has(w)) shared += 1;
      return { task, score: shared / Math.max(1, Math.min(mine.size, theirs.size)) };
    })
    .filter((s) => s.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.task);
}
