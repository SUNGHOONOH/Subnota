import { describe, expect, it } from 'vitest';
import {
  composeScheduledDate,
  toTimeFields,
} from '../features/memo/components/dateScheduleTime';

const base = new Date(2026, 5, 21); // 2026-06-21 (local)

describe('composeScheduledDate (12h field + AM/PM -> Date)', () => {
  it('12 AM is midnight', () => {
    const { date, allDay } = composeScheduledDate(base, '12:00', 'AM');
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(allDay).toBe(false);
  });

  it('12 PM is noon', () => {
    expect(composeScheduledDate(base, '12:30', 'PM').date.getHours()).toBe(12);
  });

  it('1:05 AM', () => {
    const { date } = composeScheduledDate(base, '1:05', 'AM');
    expect(date.getHours()).toBe(1);
    expect(date.getMinutes()).toBe(5);
  });

  it('11:38 PM is 23:38', () => {
    const { date } = composeScheduledDate(base, '11:38', 'PM');
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(38);
  });

  it('empty time -> all-day at 00:00', () => {
    const { date, allDay } = composeScheduledDate(base, '', 'AM');
    expect(allDay).toBe(true);
    expect(date.getHours()).toBe(0);
  });

  it('clamps an out-of-range minute', () => {
    expect(composeScheduledDate(base, '3:99', 'AM').date.getMinutes()).toBe(59);
  });

  it('keeps the picked calendar day', () => {
    expect(composeScheduledDate(base, '9:00', 'AM').date.getDate()).toBe(21);
  });
});

describe('toTimeFields <-> composeScheduledDate round-trip (modal seeding)', () => {
  it('seeds a timed date and reproduces the same instant', () => {
    const original = new Date(2026, 5, 21, 14, 30); // 2:30 PM
    const { time, meridiem } = toTimeFields(original);
    expect(time).toBe('2:30');
    expect(meridiem).toBe('PM');
    const { date } = composeScheduledDate(original, time, meridiem);
    expect(date.getTime()).toBe(original.getTime());
  });

  it('seeds midnight as empty (stays all-day)', () => {
    expect(toTimeFields(new Date(2026, 5, 21, 0, 0)).time).toBe('');
  });

  it('treats undefined / invalid dates as empty AM', () => {
    expect(toTimeFields(undefined)).toEqual({ time: '', meridiem: 'AM' });
    expect(toTimeFields(new Date('not-a-date'))).toEqual({
      time: '',
      meridiem: 'AM',
    });
  });
});
