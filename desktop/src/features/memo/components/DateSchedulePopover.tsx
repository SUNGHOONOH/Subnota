import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from '@/components/icons';
import { getUiDateLocale, localize, useUiLanguage } from '../../../lib/uiLanguage';
import { composeScheduledDate, toTimeFields, validDate } from './dateScheduleTime';

interface DateSchedulePopoverProps {
  onApplyDate: (date: Date, allDay: boolean) => void;
  onClose: () => void;
  // When provided, the picker seeds its month/time/selection from this date and
  // stays open so the parent can keep editing (used by the inbox edit modal).
  initialDate?: Date;
  // When set, the picker does NOT commit on each change; the user chooses date
  // and time, then presses this labeled button to commit once. Used by schedule
  // registration so a date click alone doesn't save before a time is picked.
  confirmLabel?: string;
}

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));

const DateSchedulePopover = ({
  onApplyDate,
  onClose,
  initialDate,
  confirmLabel,
}: DateSchedulePopoverProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const dateLocale = getUiDateLocale(language);
  const weekStartsOn = useMemo(() => {
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
  }, [dateLocale, language]);
  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 7 + ((weekStartsOn + index) % 7))),
    );
  }, [dateLocale, weekStartsOn]);
  const seed = useMemo(() => toTimeFields(initialDate), [initialDate]);
  const [time, setTime] = useState(seed.time);
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(seed.meridiem);
  const [selectedDay, setSelectedDay] = useState<Date | null>(
    validDate(initialDate) ?? null,
  );
  const [visibleMonth, setVisibleMonth] = useState(
    startOfMonth(validDate(initialDate) ?? new Date()),
  );
  const visibleYear = visibleMonth.getFullYear();
  const yearOptions = useMemo(() => {
    const baseYear = new Date().getFullYear();
    return Array.from(
      new Set([
        ...Array.from({ length: 21 }, (_, index) => baseYear - 5 + index),
        visibleYear,
      ]),
    ).sort((a, b) => a - b);
  }, [visibleYear]);
  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn }),
      end: endOfWeek(monthEnd, { weekStartsOn }),
    });
  }, [visibleMonth, weekStartsOn]);

  const applyDate = (date: Date, nextTime = time, nextMeridiem = meridiem) => {
    // 확인 버튼 모드에서는 매 변경마다 커밋하지 않고 [등록]에서 한 번만 커밋한다.
    if (confirmLabel) {
      return;
    }
    const { date: nextDate, allDay } = composeScheduledDate(
      date,
      nextTime,
      nextMeridiem,
    );
    onApplyDate(nextDate, allDay);
  };

  const handleConfirm = () => {
    if (!selectedDay) {
      return;
    }
    const { date, allDay } = composeScheduledDate(selectedDay, time, meridiem);
    onApplyDate(date, allDay);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    applyDate(date);
  };

  const [hourValue, minuteValue = '00'] = time.split(':');

  const updateTime = (nextHour: string, nextMinute = minuteValue) => {
    const next = nextHour ? `${nextHour}:${nextMinute}` : '';
    setTime(next);
    if (selectedDay) {
      applyDate(selectedDay, next);
    }
  };

  const updateMinute = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    const nextMinute =
      digits.length === 2 ? String(Math.min(Number(digits), 59)) : digits;
    updateTime(hourValue || '12', nextMinute);
  };

  const normalizeMinute = () => {
    if (!hourValue) return;
    const normalized =
      minuteValue === ''
        ? '00'
        : String(Math.min(Number(minuteValue), 59)).padStart(2, '0');
    updateTime(hourValue, normalized);
  };

  const handleMeridiem = (value: 'AM' | 'PM') => {
    setMeridiem(value);
    if (selectedDay) {
      applyDate(selectedDay, time, value);
    }
  };

  return (
    <section className="date-schedule-popover" aria-label={t('날짜 선택', 'Choose date')}>
      <header className="date-schedule-header">
        <div className="date-schedule-title">
          <strong>{new Intl.DateTimeFormat(dateLocale, { month: 'long' }).format(visibleMonth)}</strong>
          {/* 연도는 글자처럼 보이지만 여전히 select다. 몇 년 뒤로 건너뛰는
              일은 드물어도, 없애면 ‹ › 로 스무 번 눌러야 한다. */}
          <select
            aria-label={t('연도', 'Year')}
            className="date-schedule-year-select"
            onChange={event => {
              const nextYear = Number(event.target.value);
              setVisibleMonth(current => startOfMonth(new Date(nextYear, current.getMonth(), 1)));
            }}
            value={visibleYear}
          >
            {yearOptions.map(year => (
              <option key={year} value={year}>
                {t(`${year}년`, String(year))}
              </option>
            ))}
          </select>
        </div>
        <div className="date-schedule-nav">
          <button
            aria-label={t('이전 달', 'Previous month')}
            className="icon-button"
            onClick={() => setVisibleMonth(previous => addMonths(previous, -1))}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label={t('다음 달', 'Next month')}
            className="icon-button"
            onClick={() => setVisibleMonth(previous => addMonths(previous, 1))}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
          <button
            aria-label={t('닫기', 'Close')}
            className="icon-button date-schedule-close"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="date-schedule-weekdays">
        {weekdays.map(day => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="date-schedule-grid">
        {days.map(date => {
          if (!isSameMonth(date, visibleMonth)) {
            return (
              <span
                aria-hidden
                className="date-schedule-day empty"
                key={date.toISOString()}
              />
            );
          }

          const isSelected = selectedDay !== null && isSameDay(date, selectedDay);

          return (
            <button
              className={[
                'date-schedule-day',
                isSelected ? 'selected' : '',
                !isSelected && isSameDay(date, startOfToday()) ? 'today' : '',
              ]
                .join(' ')
                .trim()}
              key={date.toISOString()}
              onClick={() => handleDayClick(date)}
              type="button"
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div
        aria-label={t('시간', 'Time')}
        className="date-schedule-time-row"
        role="group"
      >
        <div className="date-schedule-time-selects">
          <select
            aria-label={t('시', 'Hour')}
            className="date-schedule-time-select"
            onChange={event => updateTime(event.target.value)}
            value={hourValue}
          >
            <option value="">--</option>
            {HOURS.map(hour => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <input
            aria-label={t('분', 'Minute')}
            className="date-schedule-minute-input"
            inputMode="numeric"
            maxLength={2}
            onBlur={normalizeMinute}
            onChange={event => updateMinute(event.target.value)}
            onFocus={event => event.currentTarget.select()}
            value={hourValue ? minuteValue : '00'}
          />
        </div>
        <div
          aria-label={t('오전/오후', 'AM/PM')}
          className="date-schedule-meridiem"
          role="group"
        >
          <button
            className={meridiem === 'AM' ? 'active' : ''}
            onClick={() => handleMeridiem('AM')}
            type="button"
          >
            {t('오전', 'AM')}
          </button>
          <button
            className={meridiem === 'PM' ? 'active' : ''}
            onClick={() => handleMeridiem('PM')}
            type="button"
          >
            {t('오후', 'PM')}
          </button>
        </div>
      </div>

      {confirmLabel && (
        <div className="date-schedule-confirm-row">
          <button
            className="date-schedule-confirm-btn"
            disabled={!selectedDay}
            onClick={handleConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </section>
  );
};

export default DateSchedulePopover;
