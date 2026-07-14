import { describe, expect, it } from 'vitest';

import { offsetToHour } from '../features/calendar/calendarUtils';

describe('offsetToHour', () => {
  it('maps a drop offset to its hour row', () => {
    expect(offsetToHour(0, 40)).toBe(0);
    expect(offsetToHour(95, 40)).toBe(2); // 95 / 40 = 2.3 → 2
  });

  it('clamps drops above or below the grid', () => {
    expect(offsetToHour(-30, 40)).toBe(0);
    expect(offsetToHour(5000, 40)).toBe(23);
  });
});
