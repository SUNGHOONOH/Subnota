import { CalendarBlockRow } from '../../../types';
import { getBlockStart } from '../../calendar/calendarUtils';

// A calendar block's date in the user's LOCAL timezone as YYYY-MM-DD.
// Built from local calendar components — never by slicing an ISO/UTC string,
// which would roll to the wrong day near midnight in non-UTC zones.
export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const blockLocalDate = (block: CalendarBlockRow): string =>
  getLocalDateString(getBlockStart(block));

export const blocksForLocalDate = (
  blocks: CalendarBlockRow[],
  localDate: string,
): CalendarBlockRow[] =>
  blocks.filter(block => blockLocalDate(block) === localDate);

// A day "waters the tree" when it has at least one block and every block on
// that day is completed.
export const isDayComplete = (blocks: CalendarBlockRow[]): boolean =>
  blocks.length > 0 && blocks.every(block => Boolean(block.is_completed));
