'use client';

/* 일정 등록 확인 바 + 날짜 선택 팝오버.
   원본은 desktop/src/features/memo/components/ScheduleConfirmPopover.tsx 와
   DateSchedulePopover.tsx. */

import { CalendarDays, ChevronLeft, ChevronRight, X } from './icons';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/* 선택 문장에서 날짜가 감지됐을 때, 바로 저장하지 않고 감지 결과를 한 줄로
   보여주는 컴팩트 확인 바. 날짜 칩을 누르면 피커로 날짜를 바꾼다. */
export function ScheduleConfirmBar({ label }: { label: string }) {
  return (
    <div className="schedule-confirm-bar">
      <span className="schedule-confirm-date">
        <span>{label}</span>
        <CalendarDays size={13} />
      </span>
      <span className="schedule-confirm-submit">등록</span>
      <span className="schedule-confirm-x">
        <X size={13} />
      </span>
    </div>
  );
}

export function DateSchedulePopover({
  month,
  year,
  daysInMonth,
  firstWeekday,
  selectedDay,
  todayDay,
  time,
  meridiem,
  confirmLabel = '등록',
}: {
  month: number;
  year: number;
  daysInMonth: number;
  /* 1일이 놓이는 요일(0=일). 그리드 앞쪽 빈 칸 수와 같다. */
  firstWeekday: number;
  selectedDay: number | null;
  todayDay: number;
  time: string;
  meridiem: 'AM' | 'PM';
  confirmLabel?: string;
}) {
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <section aria-label="날짜 선택" className="date-schedule-popover">
      <header className="date-schedule-header">
        <div className="date-schedule-title">
          <strong>{month}월</strong>
          <span>{year}년</span>
        </div>
        <div className="date-schedule-nav">
          <span>
            <ChevronLeft size={18} />
          </span>
          <span>
            <ChevronRight size={18} />
          </span>
          <span>
            <X size={16} />
          </span>
        </div>
      </header>

      <div className="date-schedule-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="date-schedule-grid">
        {cells.map((day, index) =>
          day === null ? (
            <span
              aria-hidden
              className="date-schedule-day empty"
              key={`empty-${index}`}
            />
          ) : (
            <span
              className={[
                'date-schedule-day',
                day === selectedDay ? 'selected' : '',
                day !== selectedDay && day === todayDay ? 'today' : '',
              ]
                .join(' ')
                .trim()}
              key={day}
            >
              {day}
            </span>
          ),
        )}
      </div>

      <div className="date-schedule-time-row">
        <div className="date-schedule-time-selects">{time}</div>
        <div className="date-schedule-meridiem">
          <span className={meridiem === 'AM' ? 'active' : ''}>오전</span>
          <span className={meridiem === 'PM' ? 'active' : ''}>오후</span>
        </div>
      </div>

      <div className="date-schedule-confirm-row">
        <span className="date-schedule-confirm-btn">{confirmLabel}</span>
      </div>
    </section>
  );
}
