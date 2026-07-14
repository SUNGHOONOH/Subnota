import { describe, expect, it } from 'vitest';

import { sortTodos } from '../features/calendar/calendarUtils';
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

describe('sortTodos', () => {
  it('orders timed by time, then all-day', () => {
    const t9 = block({ id: 't9', start_date: '2026-06-25T09:00:00.000Z' });
    const t14 = block({ id: 't14', start_date: '2026-06-25T14:00:00.000Z' });
    const allDay = block({ id: 'allday', all_day: true, all_day_date: '2026-06-25' });
    const done = block({ id: 'done', is_completed: true, start_date: '2026-06-25T07:00:00.000Z' });

    expect(sortTodos([done, allDay, t14, t9]).map(b => b.id)).toEqual([
      'done',
      't9',
      't14',
      'allday',
    ]);
  });

  it('does not move completed items to the bottom', () => {
    const done = block({ id: 'done', is_completed: true, start_date: '2026-06-25T06:00:00.000Z' });
    const todo = block({ id: 'todo', start_date: '2026-06-25T20:00:00.000Z' });

    expect(sortTodos([done, todo]).map(b => b.id)).toEqual(['done', 'todo']);
  });
});
