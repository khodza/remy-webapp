import { describe, expect, it } from 'vitest';
import { listTitle, normaliseListName } from './list-name';

describe('normaliseListName', () => {
  it.each([
    ['My Shopping List', 'shopping'],
    ['  the   home  projects ', 'home projects'],
    ['Wishlist', 'wishlist'],
    ['shopping list', 'shopping'],
    ['list', 'list'],
    ['', null],
    [null, null],
  ])('%j → %j', (raw, name) => {
    expect(normaliseListName(raw)).toBe(name);
  });

  it('caps the length at 40', () => {
    expect(normaliseListName('a'.repeat(50))).toHaveLength(40);
  });

  it('capitalises for display', () => {
    expect(listTitle('home projects')).toBe('Home projects');
  });
});
