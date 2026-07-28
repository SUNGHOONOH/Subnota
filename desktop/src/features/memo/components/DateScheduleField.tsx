import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
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
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !popRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Position the picker against the viewport. The field can live inside a
  // scrolling/overflow-hidden modal, so an absolutely positioned child would
  // be clipped before it reaches the available space above the field.
  useLayoutEffect(() => {
    if (!open || !ref.current) {
      return;
    }

    const updatePosition = () => {
      if (!ref.current || !popRef.current) {
        return;
      }
      const field = ref.current.getBoundingClientRect();
      const height = popRef.current.offsetHeight;
      const viewportPadding = 14;
      const width = Math.min(340, window.innerWidth - viewportPadding * 2);
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - width - viewportPadding,
      );
      const left = Math.min(Math.max(field.left, viewportPadding), maxLeft);
      const below = window.innerHeight - field.bottom - 6;
      const above = field.top - 6;
      const isTop = below < height && above > below;
      const rawTop = isTop ? field.top - height - 6 : field.bottom + 6;
      const top = Math.min(
        Math.max(rawTop, viewportPadding),
        Math.max(viewportPadding, window.innerHeight - height - viewportPadding),
      );

      setPlacement(isTop ? 'top' : 'bottom');
      setPopoverStyle({
        bottom: 'auto',
        left,
        top,
        width,
      });
    };

    let followUpFrame: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      followUpFrame = window.requestAnimationFrame(updatePosition);
    });
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      if (followUpFrame !== undefined) {
        window.cancelAnimationFrame(followUpFrame);
      }
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const valueLabel = allDay
    ? `${format(date, 'yyyy. MM. dd.')} · 종일`
    : format(date, 'yyyy. MM. dd. h:mm a');

  const popover = open ? (
    <div
      className={`date-schedule-field-popover ${placement}`}
      ref={popRef}
      style={popoverStyle}
    >
      <DateSchedulePopover
        initialDate={date}
        onApplyDate={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  ) : null;

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
      {popover && createPortal(popover, document.body)}
    </div>
  );
};

export default DateScheduleField;
