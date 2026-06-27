import { describe, expect, it } from 'vitest';

import {
  blockLocalDate,
  blocksForLocalDate,
  getLocalDateString,
  isDayComplete,
} from '../features/tree/model/dayCompletion';
import { CalendarBlockRow } from '../types';

const block = (over: Partial<CalendarBlockRow>): CalendarBlockRow => ({
  all_day: false,
  all_day_date: null,
  color: null,
  completed_at: null,
  created_at: '',
  end_date: null,
  id: 'x',
  is_completed: false,
  note: null,
  order: 0,
  start_date: '2026-06-25T09:00:00.000Z',
  title: 't',
  updated_at: '',
  ...over,
});

describe('getLocalDateString', () => {
  // Timezone-independent: a Date built from local components must echo those
  // components back, even when the same instant is the NEXT day in UTC.
  it('returns the local date even when UTC would roll to the next day', () => {
    const lateNight = new Date(2026, 5, 25, 23, 30); // local 2026-06-25 23:30
    expect(getLocalDateString(lateNight)).toBe('2026-06-25');
  });
});

describe('blockLocalDate', () => {
  it('uses all_day_date for all-day blocks', () => {
    expect(blockLocalDate(block({ all_day: true, all_day_date: '2026-06-26' }))).toBe(
      '2026-06-26',
    );
  });
});

describe('blocksForLocalDate', () => {
  it('keeps only blocks whose local date matches', () => {
    const today = block({ id: 'a', start_date: new Date(2026, 5, 25, 9).toISOString() });
    const other = block({ id: 'b', all_day: true, all_day_date: '2026-06-26' });
    expect(blocksForLocalDate([today, other], '2026-06-25').map(b => b.id)).toEqual(['a']);
  });
});

describe('isDayComplete', () => {
  it('is false for an empty day', () => {
    expect(isDayComplete([])).toBe(false);
  });

  it('is false when any block is incomplete', () => {
    expect(
      isDayComplete([block({ is_completed: true }), block({ is_completed: false })]),
    ).toBe(false);
  });

  it('is true when there is at least one block and all are completed', () => {
    expect(isDayComplete([block({ is_completed: true })])).toBe(true);
  });
});
