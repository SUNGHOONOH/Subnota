import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2 } from '@/components/icons';

import { createUuid } from '../../lib/contentHash';
import { CalendarBlockRow } from '../../types';

interface CalendarWorkspaceProps {
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

type ViewType = 'day' | 'week' | 'month';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 48;
const DEFAULT_COLOR = '#66705A';
const HOUR_MS = 60 * 60 * 1000;

// Soft Apple-like tints: light fill + same-hue text + accent bar.
const TONE_STYLE: Record<string, { accent: string; bg: string; text: string }> = {
  '#2F3437': { accent: '#3b4045', bg: '#eceef0', text: '#2f3437' },
  '#A75C4A': { accent: '#c2593f', bg: '#f7e8e3', text: '#8a4636' },
  '#66705A': { accent: '#6f7a61', bg: '#ecefe6', text: '#4b5741' },
  '#5D6A73': { accent: '#5d6a73', bg: '#e8ecee', text: '#46535b' },
};

const getTone = (color: string | null) =>
  TONE_STYLE[(color ?? '').toUpperCase()] ?? TONE_STYLE[DEFAULT_COLOR];

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getBlockStart = (block: CalendarBlockRow) =>
  block.all_day && block.all_day_date
    ? parseLocalDate(block.all_day_date)
    : new Date(block.start_date);

const getRange = (block: CalendarBlockRow) => {
  const start = getBlockStart(block);
  const end = block.end_date
    ? new Date(block.end_date)
    : new Date(start.getTime() + HOUR_MS);
  return { end, start };
};

const formatKoTime = (date: Date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const meridiem = hours < 12 ? '오전' : '오후';
  const hour12 = ((hours + 11) % 12) + 1;
  return `${meridiem} ${hour12}:${String(minutes).padStart(2, '0')}`;
};

const toLocalInputDate = (date: Date) => format(date, 'yyyy-MM-dd');

// Lay timed events into side-by-side lanes so overlaps don't stack on top of
// each other (simple interval-partitioning, good enough for a day's events).
interface LaidOutEvent {
  block: CalendarBlockRow;
  end: Date;
  lane: number;
  lanes: number;
  start: Date;
}

const layoutDayEvents = (blocks: CalendarBlockRow[]): LaidOutEvent[] => {
  const items = blocks
    .map(block => ({ block, ...getRange(block) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const laneEnds: number[] = [];
  const placed = items.map(item => {
    let lane = laneEnds.findIndex(end => end <= item.start.getTime());
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end.getTime());
    } else {
      laneEnds[lane] = item.end.getTime();
    }
    return { ...item, lane };
  });

  const lanes = Math.max(1, laneEnds.length);
  return placed.map(item => ({ ...item, lanes }));
};

const CalendarWorkspace = ({
  blocks,
  onDeleteBlock,
  onSaveBlock,
}: CalendarWorkspaceProps) => {
  const [view, setView] = useState<ViewType>('month');
  const [anchor, setAnchor] = useState(new Date());

  const [isEditorOpen, setEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CalendarBlockRow | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(toLocalInputDate(new Date()));
  const [time, setTime] = useState('09:00');

  const timeGridRef = useRef<HTMLDivElement>(null);

  const monthDays = useMemo(
    () =>
      eachDayOfInterval({
        end: endOfWeek(endOfMonth(anchor)),
        start: startOfWeek(startOfMonth(anchor)),
      }),
    [anchor],
  );
  const weekDays = useMemo(
    () =>
      eachDayOfInterval({ end: endOfWeek(anchor), start: startOfWeek(anchor) }),
    [anchor],
  );
  const timeGridDays = view === 'day' ? [anchor] : weekDays;

  const title_ = useMemo(() => {
    if (view === 'month') {
      return format(anchor, 'yyyy년 M월');
    }
    if (view === 'day') {
      return format(anchor, 'M월 d일 (E)');
    }
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return `${format(start, 'M.d')} – ${format(end, 'M.d')}`;
  }, [anchor, view]);

  // Scroll the time grid to the morning when entering week/day views.
  useEffect(() => {
    if (view === 'month' || !timeGridRef.current) {
      return;
    }
    timeGridRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, [view]);

  const move = (direction: -1 | 1) => {
    setAnchor(current => {
      if (view === 'month') {
        return addMonths(current, direction);
      }
      return addDays(current, direction * (view === 'week' ? 7 : 1));
    });
  };

  const openEditor = (date: Date, block?: CalendarBlockRow) => {
    setEditingBlock(block ?? null);
    setTitle(block?.title ?? '');
    setNote(block?.note ?? '');
    const base = block ? getBlockStart(block) : date;
    setSelectedDate(toLocalInputDate(base));
    setTime(block?.all_day ? '' : format(base, 'HH:mm'));
    setEditorOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const startDate = new Date(`${selectedDate}T${time || '00:00'}:00`);
    onSaveBlock({
      allDay: !time,
      color: editingBlock?.color ?? DEFAULT_COLOR,
      id: editingBlock?.id ?? createUuid(),
      note: note.trim() || null,
      order: editingBlock?.order ?? 0,
      startDate: startDate.toISOString(),
      title: title.trim() || '새 일정',
    });
    setEditorOpen(false);
  };

  const dayEvents = (date: Date) =>
    blocks
      .filter(block => isSameDay(getBlockStart(block), date))
      .sort(
        (a, b) =>
          getBlockStart(a).getTime() - getBlockStart(b).getTime(),
      );

  const renderMonth = () => (
    <div className="cal-month">
      <div className="cal-weekday-row">
        {DAY_LABELS.map((label, index) => (
          <span
            className={index === 0 ? 'sunday' : index === 6 ? 'saturday' : ''}
            key={label}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="cal-month-grid">
        {monthDays.map(date => {
          const events = dayEvents(date);
          const inMonth = isSameMonth(date, anchor);
          const firstOfMonth = date.getDate() === 1;
          return (
            <div
              className={`cal-month-cell${inMonth ? '' : ' muted'}`}
              key={date.toISOString()}
              onClick={() => openEditor(date)}
              role="button"
              tabIndex={0}
            >
              <span
                className={`cal-daynum${isToday(date) ? ' today' : ''}${
                  date.getDay() === 0 ? ' sunday' : ''
                }`}
              >
                {firstOfMonth ? format(date, 'M월 d일') : format(date, 'd')}
              </span>
              <div className="cal-chips">
                {events.slice(0, 3).map(block => {
                  const tone = getTone(block.color);
                  return (
                    <button
                      className="cal-chip"
                      key={block.id}
                      onClick={event => {
                        event.stopPropagation();
                        openEditor(date, block);
                      }}
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                      type="button"
                    >
                      <span className="cal-chip-dot" style={{ background: tone.accent }} />
                      <span className="cal-chip-title">{block.title}</span>
                      {!block.all_day && (
                        <span className="cal-chip-time">
                          {format(getBlockStart(block), 'a h:mm')}
                        </span>
                      )}
                    </button>
                  );
                })}
                {events.length > 3 && (
                  <span className="cal-more">{events.length - 3} more…</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTimeGrid = () => {
    const now = new Date();
    return (
      <div className={`cal-timegrid-wrap view-${view}`}>
        <div className="cal-timegrid-head">
          <div className="cal-time-gutter-head" />
          {timeGridDays.map(date => (
            <div
              className={`cal-col-head${isToday(date) ? ' today' : ''}`}
              key={date.toISOString()}
            >
              <span className="cal-col-dow">{DAY_LABELS[date.getDay()]}</span>
              <span className="cal-col-date">{format(date, 'd')}</span>
            </div>
          ))}
        </div>

        <div className="cal-allday-row">
          <div className="cal-time-gutter-head all">종일</div>
          {timeGridDays.map(date => (
            <div className="cal-allday-cell" key={date.toISOString()}>
              {dayEvents(date)
                .filter(block => block.all_day)
                .map(block => {
                  const tone = getTone(block.color);
                  return (
                    <button
                      className="cal-allday-event"
                      key={block.id}
                      onClick={() => openEditor(date, block)}
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                      type="button"
                    >
                      <span className="cal-chip-dot" style={{ background: tone.accent }} />
                      {block.title}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        <div className="cal-timegrid-scroll" ref={timeGridRef}>
          <div className="cal-timegrid-body">
            <div className="cal-time-gutter">
              {HOURS.map(hour => (
                <div className="cal-hour-label" key={hour} style={{ height: HOUR_HEIGHT }}>
                  {hour === 0
                    ? ''
                    : `${hour < 12 ? '오전' : '오후'} ${((hour + 11) % 12) + 1}시`}
                </div>
              ))}
            </div>
            {timeGridDays.map(date => {
              const laid = layoutDayEvents(
                dayEvents(date).filter(block => !block.all_day),
              );
              return (
                <div className="cal-day-col" key={date.toISOString()}>
                  {HOURS.map(hour => (
                    <div
                      className="cal-hour-cell"
                      key={hour}
                      onClick={() => {
                        const target = new Date(date);
                        target.setHours(hour, 0, 0, 0);
                        openEditor(target);
                      }}
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}
                  {isToday(date) && (
                    <div
                      className="cal-now-line"
                      style={{
                        top:
                          (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT,
                      }}
                    />
                  )}
                  {laid.map(({ block, start, end, lane, lanes }) => {
                    const tone = getTone(block.color);
                    const top = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
                    const minutes = Math.max(
                      30,
                      (end.getTime() - start.getTime()) / 60000,
                    );
                    return (
                      <button
                        className="cal-event"
                        key={block.id}
                        onClick={() => openEditor(date, block)}
                        style={{
                          backgroundColor: tone.bg,
                          borderLeft: `3px solid ${tone.accent}`,
                          color: tone.text,
                          height: (minutes / 60) * HOUR_HEIGHT - 2,
                          left: `calc(${(lane / lanes) * 100}% + 2px)`,
                          top,
                          width: `calc(${100 / lanes}% - 4px)`,
                        }}
                        type="button"
                      >
                        <strong>{block.title}</strong>
                        <span>{formatKoTime(start)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="cal-root">
      <div className="cal-header">
        <h2 className="cal-title">{title_}</h2>

        <div className="cal-views">
          {(['day', 'week', 'month'] as ViewType[]).map(key => (
            <button
              className={view === key ? 'active' : ''}
              key={key}
              onClick={() => setView(key)}
              type="button"
            >
              {key === 'day' ? '일' : key === 'week' ? '주' : '월'}
            </button>
          ))}
        </div>

        <div className="cal-nav">
          <button
            aria-label="이전"
            className="cal-nav-icon"
            onClick={() => move(-1)}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="cal-today"
            onClick={() => setAnchor(new Date())}
            type="button"
          >
            오늘
          </button>
          <button
            aria-label="다음"
            className="cal-nav-icon"
            onClick={() => move(1)}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {view === 'month' ? renderMonth() : renderTimeGrid()}

      {isEditorOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="cal-modal" onSubmit={submit}>
            <header className="cal-modal-head">
              <h2>{editingBlock ? '일정 수정' : '새 일정'}</h2>
              {editingBlock && (
                <button
                  aria-label="삭제"
                  className="cal-modal-delete"
                  onClick={() => {
                    onDeleteBlock(editingBlock.id);
                    setEditorOpen(false);
                  }}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </header>

            <label className="cal-field">
              <span>제목</span>
              <input
                autoFocus
                onChange={event => setTitle(event.target.value)}
                placeholder="일정 제목"
                value={title}
              />
            </label>
            <div className="cal-field-row">
              <label className="cal-field">
                <span>날짜</span>
                <input
                  onChange={event => setSelectedDate(event.target.value)}
                  type="date"
                  value={selectedDate}
                />
              </label>
              <label className="cal-field">
                <span>시간</span>
                <input
                  onChange={event => setTime(event.target.value)}
                  type="time"
                  value={time}
                />
              </label>
            </div>
            <label className="cal-field">
              <span>메모</span>
              <textarea
                onChange={event => setNote(event.target.value)}
                placeholder="세부 메모"
                value={note}
              />
            </label>
            <p className="cal-field-hint">시간을 비우면 종일 일정으로 저장됩니다.</p>

            <div className="cal-modal-actions">
              <button
                className="cal-btn ghost"
                onClick={() => setEditorOpen(false)}
                type="button"
              >
                취소
              </button>
              <button className="cal-btn primary" type="submit">
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CalendarWorkspace;
