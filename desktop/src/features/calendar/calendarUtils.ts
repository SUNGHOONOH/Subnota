import { CalendarBlockRow } from '../../types';

export const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getBlockStart = (block: CalendarBlockRow) =>
  block.all_day && block.all_day_date
    ? parseLocalDate(block.all_day_date)
    : new Date(block.start_date);

// Clamp a vertical drop offset (px from the top of a week day-column) to an
// hour 0–23, so drops above/below the grid still land on a valid slot.
export const offsetToHour = (offsetY: number, hourHeight: number) =>
  Math.min(23, Math.max(0, Math.floor(offsetY / hourHeight)));

// Todo ordering for a single day: timed by time, then all-day. Completion only
// changes the visual state; it should not move the item.
export const sortTodos = (blocks: CalendarBlockRow[]): CalendarBlockRow[] => {
  const rank = (block: CalendarBlockRow) =>
    block.all_day ? 1 : 0;

  return [...blocks].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) {
      return diff;
    }
    return getBlockStart(a).getTime() - getBlockStart(b).getTime();
  });
};
