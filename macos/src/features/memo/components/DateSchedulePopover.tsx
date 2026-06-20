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

interface DateSchedulePopoverProps {
  onApplyDate: (date: Date, allDay: boolean) => void;
  onClose: () => void;
}

const DateSchedulePopover = ({
  onApplyDate,
  onClose,
}: DateSchedulePopoverProps) => {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [visibleMonth]);

  const applyDate = (date: Date) => {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const hasTime = !Number.isNaN(h) && h >= 0 && h <= 23;
    const nextDate = new Date(date);

    nextDate.setHours(
      hasTime ? h : 0,
      hasTime && !Number.isNaN(m) ? Math.min(Math.max(m, 0), 59) : 0,
      0,
      0,
    );
    onApplyDate(nextDate, !hasTime);
  };

  return (
    <section className="date-schedule-popover" aria-label="날짜 선택">
      <header className="date-schedule-header">
        <button
          aria-label="이전 달"
          className="icon-button"
          onClick={() => setVisibleMonth(previous => addMonths(previous, -1))}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <strong>{format(visibleMonth, 'M')}</strong>
          <span>{format(visibleMonth, 'yyyy')}</span>
        </div>
        <button
          aria-label="다음 달"
          className="icon-button"
          onClick={() => setVisibleMonth(previous => addMonths(previous, 1))}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </header>

      <div className="date-schedule-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="date-schedule-grid">
        {days.map(date => (
          <button
            className={[
              'date-schedule-day',
              !isSameMonth(date, visibleMonth) ? 'muted' : '',
              isSameDay(date, startOfToday()) ? 'today' : '',
            ].join(' ')}
            key={date.toISOString()}
            onClick={() => applyDate(date)}
            type="button"
          >
            {format(date, 'd')}
          </button>
        ))}
      </div>

      <div className="date-schedule-time-row">
        <span>시간</span>
        <input
          inputMode="numeric"
          maxLength={2}
          onChange={event => setHour(event.target.value.replace(/\D/g, ''))}
          placeholder="시"
          value={hour}
        />
        <strong>:</strong>
        <input
          inputMode="numeric"
          maxLength={2}
          onChange={event => setMinute(event.target.value.replace(/\D/g, ''))}
          placeholder="분"
          value={minute}
        />
        <button className="icon-button" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>
    </section>
  );
};

export default DateSchedulePopover;
