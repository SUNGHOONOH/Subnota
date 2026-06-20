import { useEffect, useRef, useState } from 'react';
import Calendar from '@toast-ui/calendar';
import type { EventObject, Options } from '@toast-ui/calendar';
import { format } from 'date-fns';
import '@toast-ui/calendar/toastui-calendar.min.css';

import { ChevronLeft, ChevronRight } from '@/components/icons';
import { createUuid } from '../../lib/contentHash';
import { CalendarBlockRow } from '../../types';

interface TuiCalendarWorkspaceProps {
  blocks: CalendarBlockRow[];
  onDeleteBlock: (blockId: string) => void;
  onSaveBlock: (draft: {
    allDay: boolean;
    color: string;
    id?: string;
    note: string | null;
    order?: number;
    startDate: string;
    title: string;
  }) => void;
}

type ViewType = 'month' | 'week' | 'day';

const CALENDAR_ID = 'subnota';
const DEFAULT_COLOR = '#66705A';
const HOUR_MS = 60 * 60 * 1000;

// Untitled-UI-style soft tints: light background, dark same-hue text, a thin
// accent stripe — instead of a saturated solid fill.
const TONE_STYLE: Record<string, { accent: string; bg: string; text: string }> = {
  '#2F3437': { accent: '#2f3437', bg: '#e8eaec', text: '#2f3437' }, // ink
  '#A75C4A': { accent: '#a75c4a', bg: '#f4e7e1', text: '#8a4636' }, // clay
  '#66705A': { accent: '#66705a', bg: '#eaece3', text: '#4b5741' }, // olive
  '#5D6A73': { accent: '#5d6a73', bg: '#e7ebed', text: '#46535b' }, // steel
};

const getToneStyle = (color: string | null) =>
  TONE_STYLE[(color ?? '').toUpperCase()] ?? TONE_STYLE['#66705A'];

// TZDate (and Date) -> plain JS Date.
const toJsDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
};

const blocksToEvents = (blocks: CalendarBlockRow[]): EventObject[] =>
  blocks.map(block => {
    const start = new Date(block.start_date);
    const isAllday = Boolean(block.all_day);
    const tone = getToneStyle(block.color);

    return {
      id: block.id,
      calendarId: CALENDAR_ID,
      title: block.title || '새 일정',
      body: block.note ?? '',
      start,
      end: isAllday ? start : new Date(start.getTime() + HOUR_MS),
      isAllday,
      category: isAllday ? 'allday' : 'time',
      backgroundColor: tone.bg,
      borderColor: tone.bg,
      color: tone.text,
      customStyle: {
        borderRadius: '6px',
        borderLeft: `3px solid ${tone.accent}`,
        fontWeight: '600',
      },
    };
  });

const CALENDAR_THEME: Options['theme'] = {
  common: {
    backgroundColor: '#fbf8f3',
    border: '1px solid #ece7dd',
    dayName: { color: '#98917f' },
    holiday: { color: '#a75c4a' },
    saturday: { color: '#5d6a73' },
    today: { color: '#c2593f' },
    gridSelection: {
      backgroundColor: 'rgba(102, 112, 90, 0.12)',
      border: '1px solid #66705a',
    },
  },
};

const TuiCalendarWorkspace = ({
  blocks,
  onDeleteBlock,
  onSaveBlock,
}: TuiCalendarWorkspaceProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<Calendar | null>(null);
  // Keep the latest props/blocks reachable from the (mount-once) handlers.
  const blocksRef = useRef(blocks);
  const onSaveBlockRef = useRef(onSaveBlock);
  const onDeleteBlockRef = useRef(onDeleteBlock);
  blocksRef.current = blocks;
  onSaveBlockRef.current = onSaveBlock;
  onDeleteBlockRef.current = onDeleteBlock;

  const [view, setView] = useState<ViewType>('month');
  const [rangeLabel, setRangeLabel] = useState('');

  const updateRangeLabel = (currentView: ViewType = view) => {
    const calendar = calendarRef.current;
    if (!calendar) {
      return;
    }
    const current = toJsDate(calendar.getDate());

    if (currentView === 'month') {
      setRangeLabel(format(current, 'yyyy년 M월'));
    } else if (currentView === 'week') {
      const start = toJsDate(calendar.getDateRangeStart());
      const end = toJsDate(calendar.getDateRangeEnd());
      setRangeLabel(`${format(start, 'M.d')} – ${format(end, 'M.d')}`);
    } else {
      setRangeLabel(format(current, 'M월 d일'));
    }
  };

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const calendar = new Calendar(containerRef.current, {
      defaultView: 'month',
      isReadOnly: false,
      usageStatistics: false,
      useFormPopup: true,
      useDetailPopup: true,
      theme: CALENDAR_THEME,
      calendars: [
        {
          id: CALENDAR_ID,
          name: 'Subnota',
          backgroundColor: DEFAULT_COLOR,
          borderColor: DEFAULT_COLOR,
        },
      ],
      month: { startDayOfWeek: 0 },
      week: { startDayOfWeek: 0, taskView: false, eventView: ['time', 'allday'] },
    });
    calendarRef.current = calendar;

    calendar.on('beforeCreateEvent', (event: EventObject) => {
      const start = toJsDate(event.start);
      onSaveBlockRef.current({
        allDay: Boolean(event.isAllday),
        color: DEFAULT_COLOR,
        id: createUuid(),
        note: (typeof event.body === 'string' ? event.body.trim() : '') || null,
        order: 0,
        startDate: start.toISOString(),
        title:
          (typeof event.title === 'string' ? event.title.trim() : '') || '새 일정',
      });
    });

    calendar.on('beforeUpdateEvent', ({ event, changes }) => {
      const block = blocksRef.current.find(item => item.id === event.id);
      const isAllday = changes.isAllday ?? event.isAllday;
      const startSource = changes.start ?? event.start;
      const nextNote = changes.body ?? block?.note ?? null;
      onSaveBlockRef.current({
        allDay: Boolean(isAllday),
        color: block?.color ?? DEFAULT_COLOR,
        id: String(event.id),
        note: typeof nextNote === 'string' ? nextNote : null,
        order: block?.order ?? 0,
        startDate: toJsDate(startSource).toISOString(),
        title: String(changes.title ?? block?.title ?? '새 일정'),
      });
    });

    calendar.on('beforeDeleteEvent', (event: EventObject) => {
      if (event.id) {
        onDeleteBlockRef.current(String(event.id));
      }
    });

    updateRangeLabel('month');

    return () => {
      calendar.destroy();
      calendarRef.current = null;
    };
    // Mount once; live values are read through refs.
  }, []);

  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar) {
      return;
    }
    calendar.clear();
    calendar.createEvents(blocksToEvents(blocks));
  }, [blocks]);

  const changeView = (next: ViewType) => {
    setView(next);
    calendarRef.current?.changeView(next);
    updateRangeLabel(next);
  };

  const move = (direction: 'prev' | 'today' | 'next') => {
    const calendar = calendarRef.current;
    if (!calendar) {
      return;
    }
    if (direction === 'prev') {
      calendar.prev();
    } else if (direction === 'next') {
      calendar.next();
    } else {
      calendar.today();
    }
    updateRangeLabel();
  };

  return (
    <div className="tui-cal-layout">
      <div className="tui-cal-toolbar">
        <div className="mode-switch">
          <button
            className={view === 'month' ? 'active' : ''}
            onClick={() => changeView('month')}
            type="button"
          >
            월
          </button>
          <button
            className={view === 'week' ? 'active' : ''}
            onClick={() => changeView('week')}
            type="button"
          >
            주
          </button>
          <button
            className={view === 'day' ? 'active' : ''}
            onClick={() => changeView('day')}
            type="button"
          >
            일
          </button>
        </div>

        <div className="tui-cal-nav">
          <button
            aria-label="이전"
            className="icon-button"
            onClick={() => move('prev')}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button className="pill-button" onClick={() => move('today')} type="button">
            오늘
          </button>
          <button
            aria-label="다음"
            className="icon-button"
            onClick={() => move('next')}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <h2 className="tui-cal-title">{rangeLabel}</h2>
      </div>

      <div className="tui-cal-host" ref={containerRef} />
    </div>
  );
};

export default TuiCalendarWorkspace;
