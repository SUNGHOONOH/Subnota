import { describe, expect, it } from 'vitest';

import { parseDates } from '../lib/dateParser';

describe('date parser', () => {
  it('resolves 내일 to the day after the base date', () => {
    const base = new Date(2026, 6, 5, 14, 0, 0); // 2026-07-05
    const match = parseDates('내일 회의', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(6);
    expect(match.date.getDate()).toBe(6);
  });

  it('resolves 이틀 뒤 to two days after the base date', () => {
    const base = new Date(2026, 6, 5, 14, 0, 0); // 2026-07-05
    const match = parseDates('이틀 뒤 점검', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(6);
    expect(match.date.getDate()).toBe(7);
  });

  it('treats 24:00 as midnight of the following day', () => {
    const base = new Date(2026, 5, 22, 10, 0, 0);
    const match = parseDates('오늘 24:00', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(5);
    expect(match.date.getDate()).toBe(23);
    expect(match.date.getHours()).toBe(0);
  });
});
