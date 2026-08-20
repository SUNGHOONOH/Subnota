'use client';

/* 주간 캘린더 — 56px 시간 거터 + 7열 그리드.
   원본은 desktop/src/features/calendar/CalendarWorkspace.tsx 의 주간 뷰. */

import type { ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Inbox } from './icons';

const HOUR_HEIGHT = 38;

/* 의도된 팔레트(캘린더 카테고리 색) — 앱 토큰으로 흡수하지 말 것.
   원본은 CalendarWorkspace.tsx 의 색상 맵. 기본값은 초록(#66705A)이다. */
export const CAL_TONES = {
  green: { bg: '#ecefe6', text: '#4b5741' },
  blue: { bg: '#dceeff', text: '#1763ab' },
  purple: { bg: '#e7dfff', text: '#5131b4' },
  clay: { bg: '#f7e8e3', text: '#8a4636' },
} as const;

export type CalTone = keyof typeof CAL_TONES;

export interface CalEvent {
  id: string;
  /* 열 인덱스(0=일요일). */
  day: number;
  startHour: number;
  durationHours: number;
  title: string;
  time: string;
  tone: CalTone;
}

export interface CalDay {
  dow: string;
  date: number;
  today?: boolean;
}

export function CalendarWeek({
  title,
  days,
  hours,
  events,
  nowHour,
  dropPreview,
  onInboxSlot,
}: {
  title: string;
  days: CalDay[];
  /* 표시할 시각. 실제 앱과 같이 정시 라벨만 붙인다. */
  hours: number[];
  events: CalEvent[];
  nowHour?: number;
  dropPreview?: { day: number; startHour: number; title: string; time: string };
  onInboxSlot?: ReactNode;
}) {
  const gridHeight = hours.length * HOUR_HEIGHT;
  const top = (hour: number) => (hour - hours[0]) * HOUR_HEIGHT;

  return (
    <div className="cal-layout">
      <div className="cal-header">
        <h2 className="cal-title">{title}</h2>
        <span className="cal-inbox-button">
          <Inbox size={16} />
        </span>
        <span className="cal-inbox-button" style={{ margin: 0 }}>
          <CalendarDays size={16} />
        </span>
        <div className="cal-views">
          <span className="active">주</span>
          <span>월</span>
        </div>
        <div className="cal-nav">
          <span className="cal-nav-icon">
            <ChevronLeft size={14} />
          </span>
          <span className="cal-today">오늘</span>
          <span className="cal-nav-icon">
            <ChevronRight size={14} />
          </span>
        </div>
      </div>

      <div className="cal-timegrid-head">
        <span />
        {days.map((day) => (
          <div
            className={day.today ? 'cal-col-head today' : 'cal-col-head'}
            key={day.date}
          >
            <span className="cal-col-dow">{day.dow}</span>
            <span className="cal-col-date">{day.date}</span>
          </div>
        ))}
      </div>
      <div className="cal-allday-row" />

      <div className="cal-timegrid-scroll">
        <div className="cal-timegrid-body" style={{ height: gridHeight }}>
          <div className="cal-time-gutter">
            {hours.map((hour) => (
              <span
                className="cal-hour-label"
                key={hour}
                style={{ height: HOUR_HEIGHT }}
              >
                {hour <= 12 ? `오전 ${hour}` : `오후 ${hour - 12}`}
              </span>
            ))}
          </div>
          {days.map((day, columnIndex) => (
            <div className="cal-day-col" key={day.date}>
              {hours.map((hour) => (
                <div
                  className="cal-hour-cell"
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}
              {nowHour !== undefined && day.today && (
                <div className="cal-now-line" style={{ top: top(nowHour) }} />
              )}
              {events
                .filter((event) => event.day === columnIndex)
                .map((event) => (
                  <div
                    className="cal-event"
                    key={event.id}
                    style={{
                      background: CAL_TONES[event.tone].bg,
                      color: CAL_TONES[event.tone].text,
                      height: event.durationHours * HOUR_HEIGHT - 2,
                      top: top(event.startHour),
                    }}
                  >
                    <strong>{event.title}</strong>
                    <span>{event.time}</span>
                  </div>
                ))}
              {dropPreview && dropPreview.day === columnIndex && (
                <div
                  className="cal-schedule-drop-preview"
                  style={{
                    height: HOUR_HEIGHT - 2,
                    top: top(dropPreview.startHour),
                  }}
                >
                  <strong>{dropPreview.title}</strong>
                  <span>{dropPreview.time}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {onInboxSlot}
    </div>
  );
}


const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export interface MonthCell {
  day: number | null;
  muted?: boolean;
  today?: boolean;
  items?: { title: string; tone: CalTone }[];
}

/* 월간 격자. 흐름 전체가 아니라 "일정이 여기 앉았다"만 보여줄 때 쓴다. */
export function CalendarMonth({
  title,
  badge,
  cells,
  popItems = false,
}: {
  title: string;
  badge?: string;
  cells: MonthCell[];
  popItems?: boolean;
}) {
  return (
    <div className="cal-fragment">
      <div className="cal-fragment-head">
        <strong>{title}</strong>
        {badge && <span className="cal-fragment-badge">{badge}</span>}
      </div>
      <div className="cal-weekday-row">
        {WEEKDAYS.map((day, index) => (
          <span className={index === 0 ? 'sunday' : undefined} key={day}>
            {day}
          </span>
        ))}
      </div>
      <div className="cal-month-grid">
        {cells.map((cell, index) => (
          <div
            className={[
              'cal-month-cell',
              cell.muted ? 'muted' : '',
              cell.today ? 'today' : '',
            ]
              .join(' ')
              .trim()}
            key={index}
          >
            <span className="cal-daynum">{cell.day ?? ''}</span>
            <div className="cal-month-items">
              {cell.items?.map((item) => (
                <span
                  className={popItems ? 'cal-month-item cal-pop-item' : 'cal-month-item'}
                  key={item.title}
                  style={{
                    background: CAL_TONES[item.tone].bg,
                    color: CAL_TONES[item.tone].text,
                  }}
                >
                  <span className="cal-month-item-title">{item.title}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 주간 조각. 실제 주간 뷰와 같은 7열 헤더·시간 거터·시간 격자를 쓴다. */
export function CalendarWeekStrip({
  title,
  badge,
  hours,
  rows,
  popItems = false,
}: {
  title: string;
  badge?: string;
  hours: string[];
  popItems?: boolean;
  rows: {
    label: string;
    date: string;
    blocks: { at: number; span: number; title: string; sub?: string; tone: CalTone }[];
  }[];
}) {
  const hourHeight = 28;

  return (
    <div className="cal-fragment cal-week-fragment">
      <div className="cal-fragment-head">
        <strong>{title}</strong>
        {badge && <span className="cal-fragment-badge">{badge}</span>}
      </div>
      <div className="cal-timegrid-head cal-fragment-week-head">
        <span />
        {rows.map((row) => (
          <div className="cal-col-head" key={row.date}>
            <span className="cal-col-dow">{row.label}</span>
            <span className="cal-col-date">{row.date.slice(2)}</span>
          </div>
        ))}
      </div>
      <div className="cal-allday-row cal-fragment-week-allday" />
      <div
        className="cal-timegrid-body cal-fragment-week-grid"
        style={{ height: hours.length * hourHeight }}
      >
        <div className="cal-time-gutter">
          {hours.map((hour) => (
            <span
              className="cal-hour-label"
              key={hour}
              style={{ height: hourHeight }}
            >
              {hour}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div className="cal-day-col" key={row.date}>
            {hours.map((hour) => (
              <div
                className="cal-hour-cell"
                key={hour}
                style={{ height: hourHeight }}
              />
            ))}
            {row.blocks.map((block) => (
              <div
                className={popItems ? 'cal-event cal-pop-item' : 'cal-event'}
                key={block.title}
                style={{
                  background: CAL_TONES[block.tone].bg,
                  color: CAL_TONES[block.tone].text,
                  height: block.span * hourHeight - 2,
                  top: (block.at - 1) * hourHeight,
                }}
              >
                <strong>{block.title}</strong>
                {block.sub && <span>{block.sub}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
