import type { RefObject } from 'react';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';

import type { CalendarBlockRow, ScheduleInboxRow } from '../../../types';
import type { UiLanguage } from '../../../lib/appSettings';
import { toValidDate } from '../../../lib/viewCrashGuards';
import { hasScheduledTime } from '../../schedule/scheduleInboxUtils';
import {
  getBlockStart,
  getScheduleSuggestionTitle,
  getTone,
} from '../calendarUtils';

interface CalendarMonthViewProps {
  anchor: Date;
  dayEvents: (date: Date) => CalendarBlockRow[];
  dayLabels: string[];
  dayScheduleSuggestions: (date: Date) => ScheduleInboxRow[];
  formatCalendarDate: (date: Date) => string;
  formatCalendarTime: (date: Date) => string;
  language: UiLanguage;
  monthDays: Date[];
  monthGridRef: RefObject<HTMLDivElement | null>;
  monthVisibleItemLimit: number;
  onOpenEditor: (
    date: Date,
    block: CalendarBlockRow,
    anchor: HTMLElement | null,
  ) => void;
  onOpenSuggestionEditor: (
    item: ScheduleInboxRow,
    anchor: HTMLElement | null,
  ) => void;
  onSelectDay: (date: Date) => void;
  selectedDay: Date;
  t: (korean: string, english: string) => string;
  weekStartsOn: number;
}

type MonthItem =
  | {
      allDay: boolean;
      block: CalendarBlockRow;
      kind: 'block';
      sortTime: number;
    }
  | {
      allDay: boolean;
      kind: 'suggestion';
      scheduledAt: Date;
      sortTime: number;
      suggestion: ScheduleInboxRow;
    };

const CalendarMonthView = ({
  anchor,
  dayEvents,
  dayLabels,
  dayScheduleSuggestions,
  formatCalendarDate,
  formatCalendarTime,
  language,
  monthDays,
  monthGridRef,
  monthVisibleItemLimit,
  onOpenEditor,
  onOpenSuggestionEditor,
  onSelectDay,
  selectedDay,
  t,
  weekStartsOn,
}: CalendarMonthViewProps) => (
  <div className="cal-month">
    <div className="cal-weekday-row">
      {dayLabels.map((label, index) => (
        <span
          className={
            (weekStartsOn + index) % 7 === 0
              ? 'sunday'
              : (weekStartsOn + index) % 7 === 6
                ? 'saturday'
                : ''
          }
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
    <div className="cal-month-grid" ref={monthGridRef}>
      {monthDays.map((date) => {
        const events = dayEvents(date);
        const suggestions = dayScheduleSuggestions(date);
        const monthItems: MonthItem[] = [
          ...events.map((block) => ({
            allDay: Boolean(block.all_day),
            block,
            kind: 'block' as const,
            sortTime: getBlockStart(block).getTime(),
          })),
          ...suggestions.flatMap((suggestion) => {
            const scheduledAt = toValidDate(suggestion.scheduled_at);
            return scheduledAt
              ? [
                  {
                    allDay: !hasScheduledTime(suggestion),
                    kind: 'suggestion' as const,
                    scheduledAt,
                    sortTime: scheduledAt.getTime(),
                    suggestion,
                  },
                ]
              : [];
          }),
        ].sort(
          (a, b) =>
            Number(b.allDay) - Number(a.allDay) || a.sortTime - b.sortTime,
        );
        const visibleItems =
          monthItems.length > monthVisibleItemLimit
            ? monthItems.slice(0, Math.max(1, monthVisibleItemLimit - 1))
            : monthItems;
        const hiddenCount = monthItems.length - visibleItems.length;
        const inMonth = isSameMonth(date, anchor);
        const isSelected = isSameDay(date, selectedDay);
        return (
          <div
            aria-label={t(
              `${formatCalendarDate(date)}, ${monthItems.length}개 일정`,
              `${formatCalendarDate(date)}, ${monthItems.length} events`,
            )}
            className={`cal-month-cell${inMonth ? '' : ' muted'}${
              isSelected ? ' selected' : ''
            }`}
            key={date.toISOString()}
            onClick={() => onSelectDay(date)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectDay(date);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="cal-month-meta">
              {hiddenCount > 0 && (
                <button
                  aria-label={t(
                    `${formatCalendarDate(date)}의 나머지 일정 ${hiddenCount}개`,
                    `${hiddenCount} more events on ${formatCalendarDate(date)}`,
                  )}
                  className="cal-month-more"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectDay(date);
                  }}
                  type="button"
                >
                  {t(`+${hiddenCount}개`, `+${hiddenCount}`)}
                </button>
              )}
              <span
                className={`cal-daynum${isToday(date) ? ' today' : ''}${
                  date.getDay() === 0 ? ' sunday' : ''
                }`}
              >
                {date.getDate()}
              </span>
            </div>
            <div className="cal-month-items">
              {visibleItems.map((item) => {
                if (item.kind === 'block') {
                  const { block } = item;
                  const start = getBlockStart(block);
                  const tone = getTone(block.color);
                  return (
                    <button
                      aria-label={`${block.title}, ${block.all_day ? t('종일', 'All day') : formatCalendarTime(start)}`}
                      className={`cal-month-item${block.is_completed ? ' completed' : ''}`}
                      key={block.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenEditor(start, block, event.currentTarget);
                      }}
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="cal-month-item-dot"
                        style={{ backgroundColor: tone.accent }}
                      />
                      <span
                        className="cal-month-item-title"
                        title={block.title}
                      >
                        {block.title}
                      </span>
                      {!block.all_day && (
                        <span className="cal-month-item-time">
                          {format(start, 'HH:mm')}
                        </span>
                      )}
                    </button>
                  );
                }

                const { scheduledAt, suggestion } = item;
                const suggestionTitle =
                  getScheduleSuggestionTitle(suggestion, language);
                return (
                  <button
                    aria-label={t(
                      `${suggestionTitle} 일정 제안, ${item.allDay ? '시간 미정' : formatCalendarTime(scheduledAt)}`,
                      `${suggestionTitle} schedule suggestion, ${item.allDay ? 'time not set' : formatCalendarTime(scheduledAt)}`,
                    )}
                    className="cal-month-item cal-month-suggestion"
                    key={`suggestion:${suggestion.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenSuggestionEditor(suggestion, event.currentTarget);
                    }}
                    type="button"
                  >
                    <span
                      className="cal-month-item-title"
                      title={suggestionTitle}
                    >
                      {suggestionTitle}
                    </span>
                    {!item.allDay && (
                      <span className="cal-month-item-time">
                        {format(scheduledAt, 'HH:mm')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default CalendarMonthView;
