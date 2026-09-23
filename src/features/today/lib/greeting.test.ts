import { describe, expect, it } from 'vitest';
import { greeting, partOfDay } from './greeting';

const TASHKENT = 'Asia/Tashkent'; // UTC+5
const at = (hh: number, mm = 0) => new Date(Date.UTC(2026, 8, 23, hh - 5, mm));

describe('greeting', () => {
  it('follows the hour in the profile zone, not UTC', () => {
    // 07:30 in Tashkent is 02:30 UTC.
    expect(partOfDay(at(7, 30), TASHKENT)).toBe('morning');
    expect(partOfDay(at(7, 30), 'UTC')).toBe('night');
  });

  it('names the part of the day', () => {
    expect(greeting(at(5), TASHKENT, 'Ada')).toBe('Good morning, Ada');
    expect(greeting(at(11, 59), TASHKENT, 'Ada')).toBe('Good morning, Ada');
    expect(greeting(at(12), TASHKENT, 'Ada')).toBe('Good afternoon, Ada');
    expect(greeting(at(18), TASHKENT, 'Ada')).toBe('Good evening, Ada');
    expect(greeting(at(23, 59), TASHKENT, 'Ada')).toBe('Good evening, Ada');
    expect(greeting(at(2), TASHKENT, 'Ada')).toBe('Still up, Ada?');
  });

  it('works without a name', () => {
    expect(greeting(at(9), TASHKENT)).toBe('Good morning');
    expect(greeting(at(9), TASHKENT, '  ')).toBe('Good morning');
    expect(greeting(at(1), TASHKENT, null)).toBe('Still up?');
  });
});
