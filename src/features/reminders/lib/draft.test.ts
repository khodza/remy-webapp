import { describe, expect, it } from 'vitest';
import type { Category, Task } from '@/shared/api';
import { ambiguousTime, similarTasks, stripCategoryTags, suggestCategory } from './draft';

const TZ = 'Asia/Tashkent';
const local = (day: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 8, day, hh - 5, mm));

describe('ambiguousTime', () => {
  it('offers the other half of the day for a bare "at 5"', () => {
    expect(ambiguousTime('call mom tomorrow at 5', local(18, 17), TZ)).toEqual(local(18, 5));
    expect(ambiguousTime('call mom tomorrow at 5', local(18, 5), TZ)).toEqual(local(18, 17));
    expect(ambiguousTime('standup 9:30', local(18, 9, 30), TZ)).toEqual(local(18, 21, 30));
  });

  it('trusts am/pm, day parts, 24-hour times and durations', () => {
    expect(ambiguousTime('call mom at 5pm', local(18, 17), TZ)).toBeNull();
    expect(ambiguousTime('call mom tomorrow evening at 5', local(18, 17), TZ)).toBeNull();
    expect(ambiguousTime('call mom at 17:00', local(18, 17), TZ)).toBeNull();
    expect(ambiguousTime('stretch in 5 min', local(18, 17), TZ)).toBeNull();
    expect(ambiguousTime('buy 5 eggs', local(18, 17), TZ)).toBeNull();
  });
});

const categories: Category[] = [
  { id: 'w', name: 'Work', emoji: '💼', color: '#5B5BD6', keywords: ['standup', 'report'] },
  { id: 'h', name: 'Health', emoji: '🩺', color: '#F04438', keywords: ['dentist', 'gym'] },
  { id: 'p', name: 'Personal', emoji: '🙂', color: '#0E9F9E', keywords: ['mom'] },
];

describe('categories from the text', () => {
  it('prefers a #tag, then keywords', () => {
    expect(suggestCategory('call mom #work', categories)).toBe('w');
    expect(suggestCategory('call the dentist tomorrow', categories)).toBe('h');
    expect(suggestCategory('buy milk', categories)).toBeNull();
    // Whole words only (plurals allowed): "mom" is not in "moment".
    expect(suggestCategory('wait a moment', categories)).toBeNull();
    expect(suggestCategory('book dentists', categories)).toBe('h');
  });

  it('drops tags that named a category from the title', () => {
    expect(stripCategoryTags('Call mom #personal', categories)).toBe('Call mom');
    expect(stripCategoryTags('Fix #42 bug', categories)).toBe('Fix #42 bug');
  });
});

describe('similarTasks', () => {
  const task = (id: string, description: string, status: Task['status'] = 'pending') =>
    ({ id, description, status }) as Task;
  it('finds a likely duplicate by shared words', () => {
    const tasks = [task('1', 'Call mom'), task('2', 'Call the dentist'), task('3', 'Call mom', 'completed')];
    expect(similarTasks('call mom tomorrow', tasks).map((t) => t.id)).toEqual(['1']);
    expect(similarTasks('buy milk', tasks)).toEqual([]);
  });
});
