import { differenceInCalendarDays } from 'date-fns';

import { CalendarBlockRow } from '../../types';

export const CALENDAR_BLOCK_DRAG_TYPE =
  'application/x-subnota-calendar-block-id';
export const SCHEDULE_INBOX_DRAG_TYPE =
  'application/x-subnota-schedule-inbox-id';
export const DEFAULT_CALENDAR_EVENT_DURATION_MS = 60 * 60 * 1000;
export type CalendarResizeEdge = 'bottom' | 'left' | 'right' | 'top';

export const resizeRangeAtEdge = (
  start: Date,
  end: Date,
  edge: CalendarResizeEdge,
  nextBoundary: Date,
  minimumDurationMs: number,
) => {
  if (edge === 'left' || edge === 'top') {
    return {
      end,
      start: new Date(
        Math.min(nextBoundary.getTime(), end.getTime() - minimumDurationMs),
      ),
    };
  }

  return {
    end: new Date(
      Math.max(nextBoundary.getTime(), start.getTime() + minimumDurationMs),
    ),
    start,
  };
};

// A left/right resize represents a date span, not overnight elapsed time.
// Keep the event's time-of-day height and draw it as one horizontal bar across
// the selected date columns.
export const calendarSpanDisplayRange = (start: Date, end: Date) => {
  const daySpan = Math.max(1, differenceInCalendarDays(end, start) + 1);
  if (daySpan === 1) return { daySpan, end, start };

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const clockDurationMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : endMinutes < startMinutes
        ? 24 * 60 + endMinutes - startMinutes
        : 60;

  return {
    daySpan,
    end: new Date(start.getTime() + clockDurationMinutes * 60_000),
    start,
  };
};

export const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getBlockStart = (block: CalendarBlockRow) =>
  block.all_day && block.all_day_date
    ? parseLocalDate(block.all_day_date)
    : new Date(block.start_date);

// Clamp a vertical drop offset (px from the top of a week day-column) to an
// hour 0–23. This helper is kept for callers that need the hour row itself.
export const offsetToHour = (offsetY: number, hourHeight: number) =>
  Math.min(23, Math.max(0, Math.floor(offsetY / hourHeight)));

// 드래그 스냅 간격. 마우스로는 정밀하게 못 찍으므로 조작에만 적용하고,
// 폼·파서로 입력한 시각에는 절대 적용하지 않는다.
export const DRAG_SNAP_MINUTES = 15;

// Calendar placement snaps to DRAG_SNAP_MINUTES. Rounding (rather than
// flooring) makes a drop near the bottom half of a slot land where the user
// expects. 새 항목 배치처럼 기준 시각이 없을 때 쓴다.
export const offsetToMinutes = (
  offsetY: number,
  hourHeight: number,
  minuteStep = DRAG_SNAP_MINUTES,
) => {
  const rawMinutes = (offsetY / hourHeight) * 60;
  const snapped = Math.round(rawMinutes / minuteStep) * minuteStep;
  const lastSlot = 24 * 60 - minuteStep;
  return Math.min(lastSlot, Math.max(0, snapped));
};

// 기존 일정을 옮길 때 쓰는 시작 시각(분). 두 가지를 지킨다:
//  1) grabMinutes를 빼서 "블록에서 잡은 지점"이 커서를 따라오게 한다.
//  2) 절대 위치가 아니라 이동량(델타)만 스냅해 원래 분 오프셋을 보존한다.
//     14:17을 한 칸 내리면 14:32가 되고, 다른 날로만 옮기면 시각이 그대로다.
export const movedStartMinutes = (
  pointerMinutes: number,
  grabMinutes: number,
  originalMinutes: number,
  minuteStep = DRAG_SNAP_MINUTES,
) => {
  const target = pointerMinutes - grabMinutes;
  const delta =
    Math.round((target - originalMinutes) / minuteStep) * minuteStep;
  return Math.min(24 * 60 - 1, Math.max(0, originalMinutes + delta));
};

export const withMinutesOfDay = (date: Date, totalMinutes: number) => {
  const next = new Date(date);
  next.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return next;
};

export const dateAtDropOffset = (
  date: Date,
  offsetY: number,
  hourHeight: number,
  minuteStep = DRAG_SNAP_MINUTES,
) => withMinutesOfDay(date, offsetToMinutes(offsetY, hourHeight, minuteStep));

interface TimedRange {
  end: Date;
  start: Date;
}

// Keep drag placement within the requested day. If the dropped time collides,
// walk backwards to the closest earlier free interval instead of overlapping
// another event or hiding it in the week grid.
export const findPreviousAvailableTime = (
  requestedStart: Date,
  durationMs: number,
  occupiedRanges: TimedRange[],
) => {
  const dayStart = new Date(requestedStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const latestStart = dayEnd.getTime() - durationMs;
  if (latestStart < dayStart.getTime()) return null;

  let candidateStart = new Date(
    Math.min(requestedStart.getTime(), latestStart),
  );

  while (candidateStart.getTime() >= dayStart.getTime()) {
    const candidateEnd = candidateStart.getTime() + durationMs;
    const conflictingStarts = occupiedRanges
      .filter(
        range =>
          range.start.getTime() < candidateEnd &&
          range.end.getTime() > candidateStart.getTime(),
      )
      .map(range => range.start.getTime());

    if (conflictingStarts.length === 0) return candidateStart;

    candidateStart = new Date(Math.min(...conflictingStarts) - durationMs);
  }

  return null;
};

export const defaultCalendarEndDate = (start: Date) =>
  new Date(start.getTime() + DEFAULT_CALENDAR_EVENT_DURATION_MS);

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
