import { describe, expect, it } from 'vitest';

import { parseDates } from '../lib/dateParser';

describe('date parser', () => {
  it('treats 24:00 as midnight of the following day', () => {
    const base = new Date(2026, 5, 22, 10, 0, 0);
    const match = parseDates('오늘 24:00', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(5);
    expect(match.date.getDate()).toBe(23);
    expect(match.date.getHours()).toBe(0);
  });
});
