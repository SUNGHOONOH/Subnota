import { CalendarBlockRow } from '../../types';

export const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getBlockStart = (block: CalendarBlockRow) =>
  block.all_day && block.all_day_date
    ? parseLocalDate(block.all_day_date)
    : new Date(block.start_date);

// Todo ordering for a single day: unfinished first (timed by time, then
// all-day), completed always sink to the bottom.
export const sortTodos = (blocks: CalendarBlockRow[]): CalendarBlockRow[] => {
  const rank = (block: CalendarBlockRow) =>
    block.is_completed ? 2 : block.all_day ? 1 : 0;

  return [...blocks].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) {
      return diff;
    }
    return getBlockStart(a).getTime() - getBlockStart(b).getTime();
  });
};
