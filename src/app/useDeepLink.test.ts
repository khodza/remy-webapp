import { describe, expect, it } from 'vitest';
import { deepLinkTarget } from './useDeepLink';

describe('deepLinkTarget', () => {
  it('opens a task from ?task= or startapp=task_<id>', () => {
    expect(deepLinkTarget('?task=0123456789abcdef01234567', null)).toBe('/tasks/0123456789abcdef01234567');
    expect(deepLinkTarget('', 'task_0123456789abcdef01234567')).toBe('/tasks/0123456789abcdef01234567');
  });

  it('opens named screens', () => {
    expect(deepLinkTarget('?screen=catchup', null)).toBe('/catchup');
    expect(deepLinkTarget('', 'settings')).toBe('/settings');
    expect(deepLinkTarget('', 'week')).toBe('/week');
  });

  it('ignores anything else', () => {
    expect(deepLinkTarget('?task=nope&screen=admin', 'drop_tables')).toBeNull();
  });
});
