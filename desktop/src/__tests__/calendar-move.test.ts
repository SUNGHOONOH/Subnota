import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  dateAtDropOffset,
  calendarSpanDisplayRange,
  defaultCalendarEndDate,
  findAvailableDropStart,
  findPreviousAvailableTime,
  formatCalendarDate,
  formatCalendarTime,
  getCalendarDayLabels,
  getCalendarTitle,
  getCalendarWeekStartsOn,
  getDayEvents,
  getDayScheduleSuggestions,
  getRangeForBlock,
  getTimedEventsForDay,
  movedStartMinutes,
  offsetToMinutes,
  offsetToHour,
  resizeRangeAtEdge,
  toLocalCalendarDate,
} from '../features/calendar/calendarUtils';
import type { CalendarBlockRow, ScheduleInboxRow } from '../types';

const calendarSource = `${readFileSync(
  resolve(__dirname, '../features/calendar/CalendarWorkspace.tsx'),
  'utf8',
)}\n${readFileSync(
  resolve(__dirname, '../features/calendar/calendarUtils.ts'),
  'utf8',
)}`;
const calendarUtilsSource = readFileSync(
  resolve(__dirname, '../features/calendar/calendarUtils.ts'),
  'utf8',
);
const styles = readFileSync(
  resolve(__dirname, '../styles/subnota-workspace.scss'),
  'utf8',
);

const makeBlock = (
  overrides: Partial<CalendarBlockRow> = {},
): CalendarBlockRow => ({
  all_day: false,
  all_day_date: null,
  color: '#20B76A',
  completed_at: null,
  created_at: '2026-07-28T00:00:00.000Z',
  end_date: '2026-07-28T11:00:00.000Z',
  id: 'block-1',
  is_completed: false,
  note: null,
  order: 0,
  start_date: '2026-07-28T10:00:00.000Z',
  title: 'Event',
  updated_at: '2026-07-28T00:00:00.000Z',
  ...overrides,
});

const makeSuggestion = (
  overrides: Partial<ScheduleInboxRow> = {},
): ScheduleInboxRow => ({
  all_day: false,
  confidence: 'candidate',
  created_at: '2026-07-28T00:00:00.000Z',
  id: 'suggestion-1',
  memo_id: 'memo-1',
  scheduled_at: '2026-07-28T10:00:00.000Z',
  source_text: 'Schedule source',
  status: 'pending',
  time_text: null,
  title: 'Suggested event',
  ...overrides,
});

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

describe('toLocalCalendarDate', () => {
  it('keeps the local calendar day for all-day storage', () => {
    const localMidday = new Date(2026, 6, 28, 12);

    expect(toLocalCalendarDate(localMidday.toISOString())).toBe('2026-07-28');
  });
});

describe('calendar locale projections', () => {
  it('resolves a supported week start and seven localized labels', () => {
    const weekStartsOn = getCalendarWeekStartsOn('ko-KR', 'ko');
    const labels = getCalendarDayLabels('ko-KR', weekStartsOn);

    expect(weekStartsOn).toBeGreaterThanOrEqual(0);
    expect(weekStartsOn).toBeLessThanOrEqual(6);
    expect(labels).toHaveLength(7);
    expect(labels.every(label => label.length > 0)).toBe(true);
  });

  it('formats calendar times and dates through locale-aware helpers', () => {
    const date = new Date(2026, 6, 28, 9, 5);

    expect(formatCalendarTime('en-US', date)).toMatch(/9:05/);
    expect(formatCalendarDate('en-US', date)).toContain('July');
    expect(calendarSource).toContain('getCalendarWeekStartsOn(dateLocale, language)');
    expect(calendarSource).toContain('getCalendarTitle(anchor, view, dateLocale, weekStartsOn)');
    expect(calendarSource).toContain('formatCalendarTimeValue(dateLocale, date)');
    expect(calendarUtilsSource).toContain('export const getCalendarDayLabels');
    expect(calendarUtilsSource).toContain('export const getCalendarTitle');
  });
});

describe('calendar display projection', () => {
  const day = new Date(2026, 6, 28, 0, 0, 0, 0);

  it('filters the selected day and keeps chronological block order', () => {
    const allDay = makeBlock({
      all_day: true,
      all_day_date: '2026-07-28',
      end_date: null,
      id: 'all-day',
      start_date: '2026-07-28T00:00:00.000Z',
    });
    const later = makeBlock({
      end_date: '2026-07-28T14:00:00.000Z',
      id: 'later',
      start_date: '2026-07-28T13:00:00.000Z',
    });
    const earlier = makeBlock({ id: 'earlier' });

    expect(getDayEvents([later, allDay, earlier], day).map(block => block.id)).toEqual([
      'all-day',
      'earlier',
      'later',
    ]);
  });

  it('prefers the active resize preview and preserves multi-day display span', () => {
    const block = makeBlock({ id: 'resizing' });
    const preview = {
      blockId: 'resizing',
      end: new Date(2026, 6, 29, 11),
      start: new Date(2026, 6, 28, 12),
    };

    expect(getRangeForBlock(block, preview)).toEqual({
      end: preview.end,
      start: preview.start,
    });
    expect(getTimedEventsForDay([block], day, preview)[0]).toMatchObject({
      block,
      daySpan: 2,
      start: preview.start,
    });
  });

  it('keeps null all-day flags in the timed projection for legacy rows', () => {
    const legacyBlock = makeBlock({ all_day: null, id: 'legacy' });

    expect(getTimedEventsForDay([legacyBlock], day).map(item => item.block?.id)).toEqual([
      'legacy',
    ]);
  });

  it('excludes invalid suggestions and sorts valid suggestions by local time', () => {
    const early = makeSuggestion({ id: 'early', scheduled_at: '2026-07-28T09:00:00.000Z' });
    const late = makeSuggestion({ id: 'late', scheduled_at: '2026-07-28T11:00:00.000Z' });
    const invalid = makeSuggestion({ id: 'invalid', scheduled_at: 'not-a-date' });

    expect(getDayScheduleSuggestions([late, invalid, early], day).map(item => item.id)).toEqual([
      'early',
      'late',
    ]);
  });

  it('ignores all-day and excluded blocks when finding a free drop start', () => {
    const occupied = makeBlock({
      end_date: new Date(2026, 6, 28, 11).toISOString(),
      id: 'occupied',
      start_date: new Date(2026, 6, 28, 10).toISOString(),
    });
    const allDay = makeBlock({
      all_day: true,
      all_day_date: '2026-07-28',
      end_date: null,
      id: 'all-day',
      start_date: '2026-07-28T00:00:00.000Z',
    });
    const requested = new Date(2026, 6, 28, 10, 30);

    expect(findAvailableDropStart([occupied, allDay], requested, 60 * 60 * 1000)).toEqual(
      new Date(2026, 6, 28, 9),
    );
    expect(
      findAvailableDropStart([occupied], requested, 60 * 60 * 1000, 'occupied'),
    ).toEqual(requested);
  });
});

describe('calendar title projection', () => {
  const anchor = new Date(2026, 6, 29, 12, 0, 0, 0);

  it('keeps month titles localized with the existing month/year format', () => {
    expect(getCalendarTitle(anchor, 'month', 'en-US', 0)).toBe('July 2026');
    expect(getCalendarTitle(anchor, 'month', 'ko-KR', 0)).toContain('2026년 7월');
  });

  it('keeps week titles localized and respects the configured week start', () => {
    expect(getCalendarTitle(anchor, 'week', 'en-US', 0)).toBe('Jul 26 – Aug 1');
    expect(getCalendarTitle(anchor, 'week', 'ko-KR', 1)).toContain('7월 27일');
    expect(getCalendarTitle(anchor, 'week', 'ko-KR', 1)).toContain('8월 2일');
  });
});

describe('schedule inbox placement', () => {
  it('snaps vertical placement to quarter-hour slots', () => {
    expect(offsetToMinutes(80, 40)).toBe(120);
    expect(offsetToMinutes(99, 40)).toBe(150); // 148.5 → 150
    expect(offsetToMinutes(85, 40)).toBe(135); // 127.5 → 135
  });

  it('uses the dropped day and nearest slot', () => {
    const day = new Date(2026, 6, 28, 0, 0, 0, 0);
    const dropped = dateAtDropOffset(day, 95, 40);

    expect(dropped.getFullYear()).toBe(2026);
    expect(dropped.getMonth()).toBe(6);
    expect(dropped.getDate()).toBe(28);
    expect(dropped.getHours()).toBe(2);
    expect(dropped.getMinutes()).toBe(30); // 142.5 → 150분 = 2:30
  });

  it('defaults a placed schedule to one hour', () => {
    const start = new Date('2026-07-28T10:15:00.000Z');
    expect(defaultCalendarEndDate(start).getTime() - start.getTime()).toBe(
      60 * 60 * 1000,
    );
  });

  it('moves a conflicting drop to the closest earlier free interval', () => {
    const requestedStart = new Date(2026, 6, 28, 10, 30);
    const available = findPreviousAvailableTime(requestedStart, 60 * 60 * 1000, [
      {
        end: new Date(2026, 6, 28, 11, 0),
        start: new Date(2026, 6, 28, 10, 0),
      },
    ]);

    expect(available).toEqual(new Date(2026, 6, 28, 9, 0));
  });

  it('keeps walking backwards through consecutive events and rejects a full day', () => {
    const requestedStart = new Date(2026, 6, 28, 10, 0);
    const available = findPreviousAvailableTime(requestedStart, 60 * 60 * 1000, [
      {
        end: new Date(2026, 6, 28, 10, 0),
        start: new Date(2026, 6, 28, 8, 30),
      },
      {
        end: new Date(2026, 6, 28, 11, 0),
        start: new Date(2026, 6, 28, 10, 0),
      },
    ]);
    const allDay = Array.from({ length: 24 }, (_, hour) => ({
      end: new Date(2026, 6, 28, hour + 1),
      start: new Date(2026, 6, 28, hour),
    }));

    expect(available).toEqual(new Date(2026, 6, 28, 7, 30));
    expect(
      findPreviousAvailableTime(requestedStart, 60 * 60 * 1000, allDay),
    ).toBeNull();
  });

  it('keeps a dropped event inside the requested day', () => {
    const requestedStart = new Date(2026, 6, 28, 23, 30);

    expect(
      findPreviousAvailableTime(requestedStart, 60 * 60 * 1000, []),
    ).toEqual(new Date(2026, 6, 28, 23, 0));
  });
});

describe('movedStartMinutes (기존 일정 이동)', () => {
  // 잡은 지점 = 블록 상단에서 20분 아래, 원래 시작 = 14:17(857분)
  const grab = 20;
  const original = 14 * 60 + 17;

  it('잡은 지점을 유지한다 — 제자리에 놓으면 시각이 그대로', () => {
    // 커서가 원래 잡았던 절대 위치(877분)에 그대로 있는 경우
    expect(movedStartMinutes(original + grab, grab, original)).toBe(original);
  });

  it('이동량만 스냅해 원래 분 오프셋을 보존한다', () => {
    // 커서를 15분 아래로 → 14:32 (14:30이 아니라)
    expect(movedStartMinutes(original + grab + 15, grab, original)).toBe(
      original + 15,
    );
    // 8분만 내려도 가장 가까운 15분 단위(=15분)로 이동
    expect(movedStartMinutes(original + grab + 8, grab, original)).toBe(
      original + 15,
    );
  });

  it('격자 위 일정은 격자 위에 남는다', () => {
    const onGrid = 14 * 60; // 14:00
    expect(movedStartMinutes(onGrid + grab + 15, grab, onGrid)).toBe(
      onGrid + 15,
    );
  });

  it('Shift(step=1)면 분 단위로 움직인다', () => {
    expect(movedStartMinutes(original + grab + 8, grab, original, 1)).toBe(
      original + 8,
    );
  });

  it('하루 범위를 벗어나지 않는다', () => {
    expect(movedStartMinutes(-500, 0, original)).toBe(0);
    expect(movedStartMinutes(99999, 0, original)).toBe(24 * 60 - 1);
  });
});

describe('calendar block resize', () => {
  const start = new Date(2026, 6, 28, 10, 0);
  const end = new Date(2026, 6, 28, 11, 0);
  const fiveMinutes = 5 * 60 * 1000;

  it('changes the start date from the left edge while keeping the end intact', () => {
    const next = resizeRangeAtEdge(
      start,
      end,
      'left',
      new Date(2026, 6, 26, 10, 0),
      fiveMinutes,
    );

    expect(next.start).toEqual(new Date(2026, 6, 26, 10, 0));
    expect(next.end).toEqual(end);
  });

  it('changes the end date from the right edge and never inverts the range', () => {
    const extended = resizeRangeAtEdge(
      start,
      end,
      'right',
      new Date(2026, 6, 30, 11, 0),
      fiveMinutes,
    );
    const clamped = resizeRangeAtEdge(
      start,
      end,
      'right',
      new Date(2026, 6, 28, 9, 0),
      fiveMinutes,
    );

    expect(extended.end).toEqual(new Date(2026, 6, 30, 11, 0));
    expect(clamped.end.getTime() - clamped.start.getTime()).toBe(fiveMinutes);
  });

  it('keeps the start time fixed when shortening from the bottom edge', () => {
    const shortened = resizeRangeAtEdge(
      start,
      end,
      'bottom',
      new Date(2026, 6, 28, 10, 30),
      fiveMinutes,
    );

    expect(shortened.start).toEqual(start);
    expect(shortened.end).toEqual(new Date(2026, 6, 28, 10, 30));
  });

  it('renders a date span sideways while preserving its time-slot height', () => {
    const display = calendarSpanDisplayRange(
      new Date(2026, 6, 28, 10, 0),
      new Date(2026, 6, 29, 11, 0),
    );

    expect(display.daySpan).toBe(2);
    expect(display.start).toEqual(new Date(2026, 6, 28, 10, 0));
    expect(display.end).toEqual(new Date(2026, 6, 28, 11, 0));
  });

  it('exposes both date edges as a horizontal span in the week grid', () => {
    expect(calendarSource).toContain('const timedEventsForDay');
    expect(calendarSource).toContain('const rangeForBlock');
    expect(calendarSource).toContain('calendarResizePreview?.blockId === block.id');
    expect(calendarSource).toContain('calendarSpanDisplayRange(range.start, range.end)');
    expect(calendarSource).toContain('`calc(${spanDays * 100}% - 4px)`');
    expect(calendarSource).toContain('data-calendar-day={format(date, \'yyyy-MM-dd\')}');
    expect(calendarSource).toContain("resizeBlock(event, block, 'left')");
    expect(calendarSource).toContain("resizeBlock(event, block, 'right')");
    expect(calendarSource).toContain('calendarResizePreview');
    expect(calendarSource).not.toContain('cal-event-resize-preview');
    expect(styles).not.toContain('.cal-event-resize-preview');
    expect(styles).toMatch(
      /\.cal-event-resize\.left,[\s\S]*?\.cal-event-resize\.right\s*\{[\s\S]*?cursor:\s*ew-resize/,
    );
    expect(styles).toMatch(
      /\.cal-event:not\(\.cal-suggestion-event\)\.compact\s*\{[\s\S]*?align-items:\s*flex-start/,
    );
  });

  it('keeps short-card text density separate from resize hit areas', () => {
    expect(calendarUtilsSource).toContain(
      'export const EVENT_COMPACT_HEIGHT_PX = 24;',
    );
    expect(calendarSource).toContain('const isResizeCompact =');
    expect(calendarSource).toContain("' compact-resize'");
    expect(styles).toMatch(
      /\.cal-event\.compact-resize \.cal-event-resize\s*\{[\s\S]*?height:\s*3px/,
    );
  });

  // 공간은 제목이 먼저 가져간다. 45·60분 블록은 제목이 한 줄일 때만
  // 시간을 보이고, 두 줄 제목은 시간을 숨긴다.
  it('제목 두 줄이 45분 블록에 들어가며 한 줄일 때만 시간을 붙인다', () => {
    const base = styles.slice(
      styles.indexOf('.cal-event {'),
      styles.indexOf('.cal-event > span'),
    );
    const number = (pattern: RegExp) => Number(base.match(pattern)?.[1]);

    const padding = number(/padding: (\d+)px \d+px/) * 2;
    const titleLine = number(/strong \{[\s\S]*?line-height: (\d+)px/);
    const timeLine = number(/span \{[^}]*line-height: (\d+)px/);

    // 45분 블록 = (45/60) * 40 - 2 = 28px
    expect(padding + titleLine * 2).toBeLessThanOrEqual(28);
    // 제목 한 줄과 시간은 45분 블록에도 함께 들어간다.
    expect(padding + titleLine + timeLine).toBeLessThanOrEqual(28);
    expect(calendarUtilsSource).toContain(
      'export const EVENT_SINGLE_LINE_TIME_HEIGHT_PX = 28;',
    );
    expect(calendarSource).toContain('singleLineTimedEventKeys.has(eventKey)');
    expect(calendarSource).toContain('data-calendar-event-key={eventKey}');
    // 두 줄 제목과 시간은 90분 이상에서만 함께 보인다.
    expect(padding + titleLine * 2 + timeLine).toBeLessThanOrEqual(44);
    expect(calendarUtilsSource).toContain(
      'export const EVENT_TIME_HEIGHT_PX = 44;',
    );

    // 제목이 세 줄로 늘어나면 위 계산이 무너진다.
    expect(base).toMatch(/strong \{[\s\S]*?-webkit-line-clamp: 2/);
    // 기본은 시간 숨김 — 켜는 쪽이 .roomy 다.
    expect(styles).toMatch(
      /\.cal-event > span:not\(\.cal-event-resize\)[^{]*\{\s*display: none/,
    );
    expect(styles).toMatch(
      /\.cal-event\.roomy > span:not\(\.cal-event-resize\)[^{]*\{\s*display: block/,
    );
  });

  // 고정 12px 핸들은 위아래 합쳐 24px을 먹어, 45분 블록(28px)에서 클릭·이동에
  // 4px만 남겼다. 블록이 클수록 손해가 커지는 거꾸로 된 규칙이었다.
  it('리사이즈 핸들이 클릭 영역을 절반 넘게 먹지 않는다', () => {
    expect(styles).toMatch(
      /\.cal-event-resize \{[\s\S]*?height: min\(8px, 25%\)/,
    );
  });
});
