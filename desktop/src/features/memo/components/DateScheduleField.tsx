import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays } from '@/components/icons';
import { getUiDateLocale, localize, useUiLanguage } from '../../../lib/uiLanguage';
import DateSchedulePopover from './DateSchedulePopover';

interface DateScheduleFieldProps {
  date: Date;
  allDay: boolean;
  onChange: (date: Date, allDay: boolean) => void;
  /**
   * null이면 라벨 줄을 그리지 않는다. 일정 모달은 아이콘 행으로 값을 설명해
   * "날짜 / 시간"이라는 글자가 세로 한 줄을 그냥 먹는다. 대신 트리거에
   * 접근 가능한 이름을 붙인다.
   */
  label?: string | null;
}

// Compact value field + calendar-icon trigger. The picker only opens on click,
// so the parent keeps its own auto-filled date/time until the user adjusts it.
const DateScheduleField = ({
  date,
  allDay,
  onChange,
  label,
}: DateScheduleFieldProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const dateLocale = getUiDateLocale(language);
  const resolvedLabel = label === undefined ? t('날짜 / 시간', 'Date & time') : label;
  const shouldReduceMotion = useReducedMotion();
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
      const width = Math.min(228, window.innerWidth - viewportPadding * 2);
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
    ? `${new Intl.DateTimeFormat(dateLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)} · ${t('종일', 'All day')}`
    : new Intl.DateTimeFormat(dateLocale, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);

  /* placement는 이미 계산해 두고 위치를 정하는 데만 썼다. 같은 값을
     transform-origin에 물리면 달력이 **필드에서 자라 나온다** — 위로 열릴 땐
     아래에서, 아래로 열릴 땐 위에서. 페이드만으로는 어디서 나왔는지 알 수
     없다. AnimatePresence는 조건문 바깥에 둔다(docs/design.md). */
  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`date-schedule-field-popover ${placement}`}
          exit={{ opacity: 0, scale: 0.97 }}
          initial={{
            opacity: 0,
            scale: 0.94,
            y: placement === 'top' ? 4 : -4,
          }}
          ref={popRef}
          style={popoverStyle}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.16, ease: 'easeOut' }
          }
        >
          <DateSchedulePopover
            initialDate={date}
            onApplyDate={onChange}
            onClose={() => setOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="date-schedule-field" ref={ref}>
      {resolvedLabel !== null && (
        <span className="date-schedule-field-label">{resolvedLabel}</span>
      )}
      <button
        aria-label={resolvedLabel === null ? t('날짜 / 시간 선택', 'Choose date and time') : undefined}
        className="date-schedule-field-trigger"
        onClick={() => setOpen(value => !value)}
        type="button"
      >
        <span>{valueLabel}</span>
        <CalendarDays size={18} />
      </button>
      {createPortal(popover, document.body)}
    </div>
  );
};

export default DateScheduleField;
