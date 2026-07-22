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
import { getBlockStart, offsetToHour } from './calendarUtils';
import DateScheduleField from '../memo/components/DateScheduleField';
import DayTodoPanel from './components/DayTodoPanel';
import ForestModal from '../tree/components/ForestModal';
import TreeCard from '../tree/components/TreeCard';
import { ForestTree, GrowingTree } from '../tree/model/treeTypes';

export interface CalendarTreePanel {
  forest: ForestTree[];
  onPlant: () => void;
  tree: GrowingTree;
  userId: string;
  wateringSignal: number;
}

interface CalendarWorkspaceProps {
  blocks: CalendarBlockRow[];
  onDeleteBlock: (blockId: string) => void;
  onSaveBlock: (draft: {
    allDay: boolean;
    color: string;
    endDate?: string | null;
    id?: string;
    note: string | null;
    order?: number;
    startDate: string;
    title: string;
  }) => void;
  onToggleCompleted: (blockId: string) => void;
  treePanel: CalendarTreePanel | null;
}

type ViewType = 'week' | 'month';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 40;
// Month cells show one representative event + a "+N" badge so a busy day never
// grows the row height (keeps every week row the same ratio).
const MONTH_MAX_CHIPS = 1;
const DEFAULT_COLOR = '#66705A';
const HOUR_MS = 60 * 60 * 1000;
const MIN_EVENT_MINUTES = 30;
const RESIZE_STEP_MINUTES = 15;

// Soft Apple-like tints: light fill + same-hue text + accent bar.
const TONE_STYLE: Record<string, { accent: string; bg: string; text: string }> = {
  '#2F3437': { accent: '#3b4045', bg: '#eceef0', text: '#2f3437' },
  '#A75C4A': { accent: '#c2593f', bg: '#f7e8e3', text: '#8a4636' },
  '#66705A': { accent: '#6f7a61', bg: '#ecefe6', text: '#4b5741' },
  '#5D6A73': { accent: '#5d6a73', bg: '#e8ecee', text: '#46535b' },
};

const getTone = (color: string | null) =>
  TONE_STYLE[(color ?? '').toUpperCase()] ?? TONE_STYLE[DEFAULT_COLOR];

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
const snapResizeMinutes = (pixelDelta: number) =>
  Math.round(((pixelDelta / HOUR_HEIGHT) * 60) / RESIZE_STEP_MINUTES) *
  RESIZE_STEP_MINUTES;

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
  onToggleCompleted,
  treePanel,
}: CalendarWorkspaceProps) => {
  const [view, setView] = useState<ViewType>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [forestOpen, setForestOpen] = useState(false);

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

  const title_ = useMemo(() => {
    if (view === 'month') {
      return format(anchor, 'yyyy년 M월');
    }
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return `${format(start, 'M.d')} – ${format(end, 'M.d')}`;
  }, [anchor, view]);

  // Scroll the time grid to the morning when entering the week view.
  useEffect(() => {
    if (view === 'month' || !timeGridRef.current) {
      return;
    }
    timeGridRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, [view]);

  const move = (direction: -1 | 1) => {
    setAnchor(current =>
      view === 'month'
        ? addMonths(current, direction)
        : addDays(current, direction * 7),
    );
  };

  const selectDay = (date: Date) => {
    setSelectedDay(date);
    setAnchor(date);
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
    const previousRange = editingBlock ? getRange(editingBlock) : null;
    const duration = previousRange
      ? Math.max(
          MIN_EVENT_MINUTES * 60_000,
          previousRange.end.getTime() - previousRange.start.getTime(),
        )
      : HOUR_MS;
    onSaveBlock({
      allDay: !time,
      color: editingBlock?.color ?? DEFAULT_COLOR,
      endDate: time ? new Date(startDate.getTime() + duration).toISOString() : null,
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

  // Week-view drag-and-drop: native HTML5 drag moves a timed event to the
  // dropped day+hour. No library, no handle — a click stays a click.
  const startDrag = (event: React.DragEvent, blockId: string) => {
    event.dataTransfer.setData('text/plain', blockId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const dropOnColumn = (event: React.DragEvent, date: Date) => {
    event.preventDefault();
    const block = blocks.find(
      item => item.id === event.dataTransfer.getData('text/plain'),
    );
    if (!block) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const next = new Date(date);
    next.setHours(offsetToHour(event.clientY - rect.top, HOUR_HEIGHT), 0, 0, 0);
    const { end, start } = getRange(block);
    const duration = Math.max(
      MIN_EVENT_MINUTES * 60_000,
      end.getTime() - start.getTime(),
    );
    onSaveBlock({
      allDay: !!block.all_day,
      color: block.color ?? DEFAULT_COLOR,
      endDate: block.all_day
        ? null
        : new Date(next.getTime() + duration).toISOString(),
      id: block.id,
      note: block.note,
      order: block.order ?? 0,
      startDate: next.toISOString(),
      title: block.title,
    });
  };

  const resizeBlock = (
    event: React.PointerEvent,
    block: CalendarBlockRow,
    edge: 'bottom' | 'top',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    // Capture the pointer so the synthetic click after pointerup targets this
    // handle (whose onClick stops propagation) instead of the event <button>.
    // Without this, shrinking ends the drag inside the button and the click
    // opens the detail editor; growing ends outside and doesn't.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    const startY = event.clientY;
    const { end, start } = getRange(block);

    const finish = (clientY: number) => {
      const deltaMs = snapResizeMinutes(clientY - startY) * 60_000;
      const minMs = MIN_EVENT_MINUTES * 60_000;
      const nextStart =
        edge === 'top'
          ? new Date(Math.min(start.getTime() + deltaMs, end.getTime() - minMs))
          : start;
      const nextEnd =
        edge === 'bottom'
          ? new Date(Math.max(end.getTime() + deltaMs, start.getTime() + minMs))
          : end;

      onSaveBlock({
        allDay: false,
        color: block.color ?? DEFAULT_COLOR,
        endDate: nextEnd.toISOString(),
        id: block.id,
        note: block.note,
        order: block.order ?? 0,
        startDate: nextStart.toISOString(),
        title: block.title,
      });
    };

    const onPointerUp = (pointerEvent: PointerEvent) => {
      window.removeEventListener('pointerup', onPointerUp);
      finish(pointerEvent.clientY);
    };

    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

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
          const isSelected = isSameDay(date, selectedDay);
          return (
            <div
              className={`cal-month-cell${inMonth ? '' : ' muted'}${
                isSelected ? ' selected' : ''
              }`}
              key={date.toISOString()}
              onClick={() => selectDay(date)}
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
                {events.slice(0, MONTH_MAX_CHIPS).map(block => {
                  const tone = getTone(block.color);
                  return (
                    <button
                      className={`cal-chip${block.is_completed ? ' completed' : ''}`}
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
                {events.length > MONTH_MAX_CHIPS && (
                  <span className="cal-more">+{events.length - MONTH_MAX_CHIPS}</span>
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
      <div className="cal-timegrid-wrap view-week">
        <div className="cal-timegrid-head">
          <div className="cal-time-gutter-head" />
          {weekDays.map(date => (
            <div
              className={`cal-col-head${isToday(date) ? ' today' : ''}${
                isSameDay(date, selectedDay) ? ' selected' : ''
              }`}
              key={date.toISOString()}
              onClick={() => setSelectedDay(date)}
              role="button"
              tabIndex={0}
            >
              <span className="cal-col-dow">{DAY_LABELS[date.getDay()]}</span>
              <span className="cal-col-date">{format(date, 'd')}</span>
            </div>
          ))}
        </div>

        <div className="cal-allday-row">
          <div className="cal-time-gutter-head all">종일</div>
          {weekDays.map(date => (
            <div className="cal-allday-cell" key={date.toISOString()}>
              {dayEvents(date)
                .filter(block => block.all_day)
                .map(block => {
                  const tone = getTone(block.color);
                  return (
                    <button
                      className={`cal-allday-event${block.is_completed ? ' completed' : ''}`}
                      key={block.id}
                      onClick={() => openEditor(date, block)}
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                      type="button"
                    >
                      <span className="cal-chip-dot" style={{ background: tone.accent }} />
                      <span className="cal-allday-event-title" title={block.title}>
                        {block.title}
                      </span>
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
            {weekDays.map(date => {
              const laid = layoutDayEvents(
                dayEvents(date).filter(block => !block.all_day),
              );
              return (
                <div
                  className="cal-day-col"
                  key={date.toISOString()}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => dropOnColumn(event, date)}
                >
                  {HOURS.map(hour => (
                    <div
                      className="cal-hour-cell"
                      key={hour}
                      onClick={() => {
                        const target = new Date(date);
                        target.setHours(hour, 0, 0, 0);
                        setSelectedDay(date);
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
                        className={`cal-event${block.is_completed ? ' completed' : ''}`}
                        draggable
                        key={block.id}
                        onClick={() => openEditor(date, block)}
                        onDragStart={event => startDrag(event, block.id)}
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
                        <span
                          aria-hidden="true"
                          className="cal-event-resize top"
                          draggable={false}
                          onClick={event => event.stopPropagation()}
                          onPointerDown={event => resizeBlock(event, block, 'top')}
                        />
                        <strong>{block.title}</strong>
                        <span>{formatKoTime(start)}</span>
                        <span
                          aria-hidden="true"
                          className="cal-event-resize bottom"
                          draggable={false}
                          onClick={event => event.stopPropagation()}
                          onPointerDown={event => resizeBlock(event, block, 'bottom')}
                        />
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
    <div className={`cal-layout view-${view}`}>
      <div className="cal-root">
        <div className="cal-header">
          <h2 className="cal-title">{title_}</h2>

          <div className="cal-toolbar">
            <div className="cal-views">
              {(['week', 'month'] as ViewType[]).map(key => (
                <button
                  className={view === key ? 'active' : ''}
                  key={key}
                  onClick={() => setView(key)}
                  type="button"
                >
                  {key === 'week' ? '주' : '월'}
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
                onClick={() => {
                  setAnchor(new Date());
                  setSelectedDay(new Date());
                }}
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
        </div>

        {view === 'month' ? renderMonth() : renderTimeGrid()}
      </div>

      {view === 'month' && (
        <aside className="cal-side">
          <DayTodoPanel
            blocks={dayEvents(selectedDay)}
            date={selectedDay}
            onAdd={() => openEditor(selectedDay)}
            onEdit={block => openEditor(getBlockStart(block), block)}
            onToggle={onToggleCompleted}
          />
          {treePanel && (
            <TreeCard
              forestCount={treePanel.forest.length}
              onOpenForest={() => setForestOpen(true)}
              onPlant={treePanel.onPlant}
              tree={treePanel.tree}
              wateringSignal={treePanel.wateringSignal}
            />
          )}
        </aside>
      )}

      {treePanel && forestOpen && (
        <ForestModal
          forest={treePanel.forest}
          growing={treePanel.tree}
          onClose={() => setForestOpen(false)}
          userId={treePanel.userId}
        />
      )}

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
            <DateScheduleField
              allDay={!time}
              date={new Date(`${selectedDate}T${time || '00:00'}:00`)}
              onChange={(date, allDay) => {
                setSelectedDate(toLocalInputDate(date));
                setTime(allDay ? '' : format(date, 'HH:mm'));
              }}
            />
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
