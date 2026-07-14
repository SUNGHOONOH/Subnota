import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays } from '@/components/icons';
import DateSchedulePopover from './DateSchedulePopover';

interface DateScheduleFieldProps {
  date: Date;
  allDay: boolean;
  onChange: (date: Date, allDay: boolean) => void;
  label?: string;
}

// Compact value field + calendar-icon trigger. The picker only opens on click,
// so the parent keeps its own auto-filled date/time until the user adjusts it.
const DateScheduleField = ({
  date,
  allDay,
  onChange,
  label = '날짜 / 시간',
}: DateScheduleFieldProps) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Flip above the field when there isn't enough room below, so the picker
  // never gets clipped off the bottom of the screen.
  useLayoutEffect(() => {
    if (!open || !ref.current || !popRef.current) {
      return;
    }
    const field = ref.current.getBoundingClientRect();
    const height = popRef.current.offsetHeight;
    const below = window.innerHeight - field.bottom - 6;
    const above = field.top - 6;
    setPlacement(below < height && above > below ? 'top' : 'bottom');
  }, [open]);

  const valueLabel = allDay
    ? `${format(date, 'yyyy. MM. dd.')} · 종일`
    : format(date, 'yyyy. MM. dd. h:mm a');

  return (
    <div className="date-schedule-field" ref={ref}>
      <span className="date-schedule-field-label">{label}</span>
      <button
        className="date-schedule-field-trigger"
        onClick={() => setOpen(value => !value)}
        type="button"
      >
        <span>{valueLabel}</span>
        <CalendarDays size={18} />
      </button>
      {open && (
        <div className={`date-schedule-field-popover ${placement}`} ref={popRef}>
          <DateSchedulePopover
            initialDate={date}
            onApplyDate={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DateScheduleField;
