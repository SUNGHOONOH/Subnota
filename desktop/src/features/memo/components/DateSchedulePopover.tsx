import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from '@/components/icons';
import { composeScheduledDate, toTimeFields, validDate } from './dateScheduleTime';

interface DateSchedulePopoverProps {
  onApplyDate: (date: Date, allDay: boolean) => void;
  onClose: () => void;
  // When provided, the picker seeds its month/time/selection from this date and
  // stays open so the parent can keep editing (used by the inbox edit modal).
  initialDate?: Date;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));

const DateSchedulePopover = ({
  onApplyDate,
  onClose,
  initialDate,
}: DateSchedulePopoverProps) => {
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
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [visibleMonth]);

  const applyDate = (date: Date, nextTime = time, nextMeridiem = meridiem) => {
    const { date: nextDate, allDay } = composeScheduledDate(
      date,
      nextTime,
      nextMeridiem,
    );
    onApplyDate(nextDate, allDay);
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
    <section className="date-schedule-popover" aria-label="날짜 선택">
      <header className="date-schedule-header">
        <div className="date-schedule-title">
          <strong>{format(visibleMonth, 'MMMM')}</strong>
          <select
            aria-label="연도"
            className="date-schedule-year-select"
            onChange={event => {
              const nextYear = Number(event.target.value);
              setVisibleMonth(current => startOfMonth(new Date(nextYear, current.getMonth(), 1)));
            }}
            value={visibleYear}
          >
            {yearOptions.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="date-schedule-nav">
          <button
            aria-label="이전 달"
            className="icon-button"
            onClick={() => setVisibleMonth(previous => addMonths(previous, -1))}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="다음 달"
            className="icon-button"
            onClick={() => setVisibleMonth(previous => addMonths(previous, 1))}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
          <button
            aria-label="닫기"
            className="icon-button date-schedule-close"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="date-schedule-weekdays">
        {WEEKDAYS.map(day => (
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
              {format(date, 'd')}
            </button>
          );
        })}
      </div>

      <div className="date-schedule-time-row">
        <span>시간</span>
        <div className="date-schedule-time-selects">
          <select
            aria-label="시"
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
            aria-label="분"
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
          aria-label="오전/오후"
          className="date-schedule-meridiem"
          role="group"
        >
          <button
            className={meridiem === 'AM' ? 'active' : ''}
            onClick={() => handleMeridiem('AM')}
            type="button"
          >
            AM
          </button>
          <button
            className={meridiem === 'PM' ? 'active' : ''}
            onClick={() => handleMeridiem('PM')}
            type="button"
          >
            PM
          </button>
        </div>
      </div>
    </section>
  );
};

export default DateSchedulePopover;
