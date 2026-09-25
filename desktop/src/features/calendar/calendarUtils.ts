import {
  differenceInCalendarDays,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns';

import type { CalendarBlockRow, ScheduleInboxRow } from '../../types';
import type { UiLanguage } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';
import { toValidDate } from '../../lib/viewCrashGuards';
import { DEFAULT_CALENDAR_COLOR } from './calendarCategories';

export const CALENDAR_BLOCK_DRAG_TYPE =
  'application/x-subnota-calendar-block-id';
export const SCHEDULE_INBOX_DRAG_TYPE =
  'application/x-subnota-schedule-inbox-id';
export const DEFAULT_CALENDAR_EVENT_DURATION_MS = 60 * 60 * 1000;
export type CalendarResizeEdge = 'bottom' | 'left' | 'right' | 'top';
// 드래그 스냅 간격. 마우스로는 정밀하게 못 찍으므로 조작에만 적용하고,
// 폼·파서로 입력한 시각에는 절대 적용하지 않는다.
export const DRAG_SNAP_MINUTES = 15;

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
export const HOUR_HEIGHT = 40;
export const DEFAULT_COLOR = DEFAULT_CALENDAR_COLOR;
export const HOUR_MS = DEFAULT_CALENDAR_EVENT_DURATION_MS;

export const getCalendarWeekStartsOn = (
  dateLocale: string,
  language: UiLanguage,
) => {
  const locale = new Intl.Locale(dateLocale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
  };
  const firstDay = locale.getWeekInfo?.().firstDay;
  return (firstDay === undefined ? (language === 'en' ? 1 : 0) : firstDay % 7) as
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
};

export const getCalendarDayLabels = (
  dateLocale: string,
  weekStartsOn: number,
) => {
  const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2024, 0, 7 + ((weekStartsOn + index) % 7))),
  );
};

export const formatCalendarTime = (dateLocale: string, date: Date) =>
  new Intl.DateTimeFormat(dateLocale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

export const formatCalendarDate = (dateLocale: string, date: Date) =>
  new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'long',
  }).format(date);

export const getCalendarTitle = (
  anchor: Date,
  view: 'week' | 'month',
  dateLocale: string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
) => {
  if (view === 'month') {
    return new Intl.DateTimeFormat(dateLocale, {
      month: 'long',
      year: 'numeric',
    }).format(anchor);
  }

  const start = startOfWeek(anchor, { weekStartsOn });
  const end = endOfWeek(anchor, { weekStartsOn });
  const formatter = new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'short',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

// 일정 길이는 데이터 그대로 저장한다. 30분은 "블록이 너무 납작해 글자가 안
// 들어간다"는 렌더 문제였을 뿐이라, 최소 높이(px)로만 남긴다.
// 13px = 제목 한 줄(line-height 13)이 들어가는 최소값. 18px이던 시절에는
// 15분(실제 8px)과 30분(18px)이 화면에서 똑같아 보였다.
export const EVENT_MIN_HEIGHT_PX = 13;
// 공간은 제목이 먼저 가져간다. 시간은 남을 때만 붙는 정보다 — 제목을 잘라
// 가며 보여 줄 값이 아니다. 45·60분 카드는 제목이 한 줄일 때만 시간을
// 붙이고, 제목이 두 줄이면 제목을 우선한다.
//
//   ~24px   제목 한 줄            15·30분
//   ~43px   제목 두 줄 / 한 줄 + 시간 45·60분
//   44px~   제목 두 줄 + 시간     90분 이상
//
// 두 줄은 2 + 13 × 2 = 28px를 쓰므로 45분(28px)에 꼭 맞고,
// 제목 한 줄과 시간은 2 + 13 + 11 = 26px라 45분부터 가능하다.
export const EVENT_COMPACT_HEIGHT_PX = 24;
export const EVENT_SINGLE_LINE_TIME_HEIGHT_PX = 28;
export const EVENT_TIME_HEIGHT_PX = 44;
// 리사이즈로 만들 수 있는 최소 길이. 0/역방향만 막는다.
export const MIN_EVENT_MINUTES = 5;
export const MONTH_CELL_CHROME_HEIGHT = 34;
export const MONTH_ITEM_ROW_HEIGHT = 19;
export const MONTH_MAX_VISIBLE_ITEM_LIMIT = 5;
export const RESIZE_STEP_MINUTES = DRAG_SNAP_MINUTES;

// Soft Apple-like tints: light fill + same-hue text + accent bar.
const TONE_STYLE: Record<
  string,
  { accent: string; bg: string; text: string }
> = {
  '#20B76A': { accent: '#20b76a', bg: '#d9f8e6', text: '#127343' },
  '#2E8FE5': { accent: '#2e8fe5', bg: '#dceeff', text: '#1763ab' },
  '#7650E6': { accent: '#7650e6', bg: '#e7dfff', text: '#5131b4' },
  '#E24782': { accent: '#e24782', bg: '#fce1ec', text: '#ad2758' },
  '#FF5357': { accent: '#ff5357', bg: '#ffe0e0', text: '#b62e34' },
  '#FFB31A': { accent: '#ffb31a', bg: '#fff0c9', text: '#a86c00' },
  '#2F3437': { accent: '#3b4045', bg: '#eceef0', text: '#2f3437' },
  '#A75C4A': { accent: '#c2593f', bg: '#f7e8e3', text: '#8a4636' },
  '#66705A': { accent: '#6f7a61', bg: '#ecefe6', text: '#4b5741' },
  '#5D6A73': { accent: '#5d6a73', bg: '#e8ecee', text: '#46535b' },
  '#7A6688': { accent: '#7a6688', bg: '#eee9f0', text: '#594565' },
  '#A47A36': { accent: '#a47a36', bg: '#f4eddf', text: '#76541d' },
};

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

export const toLocalCalendarDate = (value: string) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const getBlockStart = (block: CalendarBlockRow) =>
  block.all_day && block.all_day_date
    ? parseLocalDate(block.all_day_date)
    : new Date(block.start_date);

const clampColorChannel = (value: number) =>
  Math.max(0, Math.min(255, value));

const mixHex = (source: string, target: string, amount: number) => {
  const channel = (index: number) =>
    clampColorChannel(
      Math.round(
        Number.parseInt(source.slice(index, index + 2), 16) * (1 - amount) +
          Number.parseInt(target.slice(index, index + 2), 16) * amount,
      ),
    )
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

export const hexToRgba = (color: string) => {
  const normalized = color.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 1)`;
};

export const getTone = (color: string | null) => {
  const normalized = (color ?? '').toUpperCase();
  const preset = TONE_STYLE[normalized];
  if (preset) return preset;
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return TONE_STYLE[DEFAULT_COLOR];
  return {
    accent: normalized,
    bg: mixHex(normalized, '#FFFFFF', 0.8),
    text: mixHex(normalized, '#1D1D1F', 0.48),
  };
};

export const getRange = (block: CalendarBlockRow) => {
  const start = getBlockStart(block);
  const end = block.end_date
    ? new Date(block.end_date)
    : new Date(start.getTime() + HOUR_MS);
  return { end, start };
};

export const getScheduleSuggestionTitle = (
  item: ScheduleInboxRow,
  language: 'en' | 'ko',
) =>
  item.title.trim() ||
  item.source_text.trim() ||
  localize(language, '일정 제안', 'Schedule suggestion');

export const toLocalInputDate = (date: Date) => format(date, 'yyyy-MM-dd');
// Shift를 누르고 있으면 스냅을 끄고 1분 단위로 조정한다 (Fantastical 관례).
export const snapResizeMinutes = (
  pixelDelta: number,
  step = RESIZE_STEP_MINUTES,
) => Math.round(((pixelDelta / HOUR_HEIGHT) * 60) / step) * step;

export const timeGridOffset = (date: Date) =>
  (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;

export const formatPreviewDuration = (
  durationMs: number,
  language: 'en' | 'ko',
) => {
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return minutes % 60 === 0
    ? localize(language, `${minutes / 60}시간`, `${minutes / 60} hr`)
    : localize(language, `${minutes}분`, `${minutes} min`);
};

export interface CalendarDropPreview {
  dateKey: string;
  durationMs: number;
  isAvailable: boolean;
  start: Date;
  title: string;
}

export interface CalendarResizePreview {
  blockId: string;
  end: Date;
  start: Date;
}

// New drops do not create overlaps. This fallback keeps an old conflicting
// record from expanding into many unreadable rows until the user adjusts it.
export interface TimedCalendarItem {
  block: CalendarBlockRow | null;
  daySpan: number;
  end: Date;
  suggestion: ScheduleInboxRow | null;
  start: Date;
}

interface LaidOutEvent extends TimedCalendarItem {
  overflowCount: number;
  stackCount: number;
  stackIndex: number;
  stackRowHeight: number;
  stackStart: Date;
}

export const layoutTimedItems = (
  items: TimedCalendarItem[],
): LaidOutEvent[] => {
  const sorted = items
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const groups: TimedCalendarItem[][] = [];
  let currentGroup: TimedCalendarItem[] = [];
  let currentGroupEnd = 0;

  sorted.forEach((item) => {
    const itemStart = item.start.getTime();
    if (currentGroup.length === 0 || itemStart >= currentGroupEnd) {
      currentGroup = [item];
      groups.push(currentGroup);
      currentGroupEnd = item.end.getTime();
      return;
    }

    currentGroup.push(item);
    currentGroupEnd = Math.max(currentGroupEnd, item.end.getTime());
  });

  return groups.flatMap((group) => {
    const isStacked = group.length > 1;
    const stackStart = group[0].start;
    const stackEnd = Math.max(...group.map((item) => item.end.getTime()));
    const stackRowHeight = isStacked
      ? Math.max(
          HOUR_HEIGHT / 2,
          ((stackEnd - stackStart.getTime()) / 3_600_000) * HOUR_HEIGHT,
        )
      : 0;
    const representative = group
      .slice()
      .sort(
        (a, b) =>
          a.start.getTime() - b.start.getTime() ||
          Number(Boolean(b.block)) - Number(Boolean(a.block)),
      )[0];

    return [
      {
        ...representative,
        overflowCount: Math.max(0, group.length - 1),
        stackCount: group.length,
        stackIndex: 0,
        stackRowHeight,
        stackStart,
      },
    ];
  });
};

export const getDayEvents = (
  blocks: CalendarBlockRow[],
  date: Date,
) =>
  blocks
    .filter((block) => isSameDay(getBlockStart(block), date))
    .sort((a, b) => getBlockStart(a).getTime() - getBlockStart(b).getTime());

export const getRangeForBlock = (
  block: CalendarBlockRow,
  calendarResizePreview?: CalendarResizePreview | null,
) =>
  calendarResizePreview?.blockId === block.id
    ? {
        end: calendarResizePreview.end,
        start: calendarResizePreview.start,
      }
    : getRange(block);

export const getTimedEventsForDay = (
  blocks: CalendarBlockRow[],
  date: Date,
  calendarResizePreview?: CalendarResizePreview | null,
): TimedCalendarItem[] =>
  blocks
    .filter((block) => !block.all_day)
    .flatMap((block) => {
      const range = getRangeForBlock(block, calendarResizePreview);
      if (!isSameDay(range.start, date)) return [];

      return [
        {
          block,
          suggestion: null,
          ...calendarSpanDisplayRange(range.start, range.end),
        },
      ];
    });

export const getDayScheduleSuggestions = (
  scheduleSuggestions: ScheduleInboxRow[],
  date: Date,
) =>
  scheduleSuggestions
    .filter((item) => {
      const scheduledAt = toValidDate(item.scheduled_at);
      return scheduledAt ? isSameDay(scheduledAt, date) : false;
    })
    .sort((a, b) => {
      const aDate = toValidDate(a.scheduled_at);
      const bDate = toValidDate(b.scheduled_at);
      return (aDate?.getTime() ?? 0) - (bDate?.getTime() ?? 0);
    });

// Clamp a vertical drop offset (px from the top of a week day-column) to an
// hour 0–23. This helper is kept for callers that need the hour row itself.
export const offsetToHour = (offsetY: number, hourHeight: number) =>
  Math.min(23, Math.max(0, Math.floor(offsetY / hourHeight)));

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

export const findAvailableDropStart = (
  blocks: CalendarBlockRow[],
  requestedStart: Date,
  durationMs: number,
  excludeBlockId?: string,
) =>
  findPreviousAvailableTime(
    requestedStart,
    durationMs,
    blocks
      .filter((block) => !block.all_day && block.id !== excludeBlockId)
      .map((block) => getRange(block)),
  );

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
