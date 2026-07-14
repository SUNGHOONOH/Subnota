// Pure time helpers for DateSchedulePopover (extracted so they are unit-testable
// without a DOM). The picker uses a 12-hour field + AM/PM toggle but the rest of
// the app works in Date objects, so these convert between the two.

export const validDate = (date?: Date) =>
  date && !Number.isNaN(date.getTime()) ? date : undefined;

// Date -> { "h:mm", AM/PM } for seeding the picker. Midnight is treated as "no
// time" so re-opening an all-day item keeps its all-day semantics.
export const toTimeFields = (
  date?: Date,
): { time: string; meridiem: 'AM' | 'PM' } => {
  const valid = validDate(date);
  if (!valid) {
    return { time: '', meridiem: 'AM' };
  }
  const h24 = valid.getHours();
  const minute = valid.getMinutes();
  if (h24 === 0 && minute === 0) {
    return { time: '', meridiem: 'AM' };
  }
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { time: `${h12}:${String(minute).padStart(2, '0')}`, meridiem };
};

// (day, "h:mm", AM/PM) -> the scheduled Date + whether it is all-day.
// Empty/invalid time => all-day at 00:00.
export const composeScheduledDate = (
  base: Date,
  time: string,
  meridiem: 'AM' | 'PM',
): { date: Date; allDay: boolean } => {
  const [hourRaw, minuteRaw] = time.split(':');
  const h12 = parseInt(hourRaw, 10);
  const minute = parseInt(minuteRaw, 10);
  const hasTime = !Number.isNaN(h12) && h12 >= 1 && h12 <= 12;
  const hour24 = hasTime ? (h12 % 12) + (meridiem === 'PM' ? 12 : 0) : 0;
  const date = new Date(base);

  date.setHours(
    hour24,
    hasTime && !Number.isNaN(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
    0,
    0,
  );
  return { date, allDay: !hasTime };
};
