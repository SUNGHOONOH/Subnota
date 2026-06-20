import { FormEvent, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from '@/components/icons';

import { createUuid } from '../../lib/contentHash';
import { getWeekDates, getWeekLabel } from '../../lib/date';
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

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_SLOTS = [4, 8, 12, 16, 20];

const toLocalInputDate = (date: Date) => format(date, 'yyyy-MM-dd');

const TONE_BY_COLOR: Record<string, 'ink' | 'clay' | 'olive' | 'steel'> = {
  '#2F3437': 'ink',
  '#A75C4A': 'clay',
  '#66705A': 'olive',
  '#5D6A73': 'steel',
};

const getTone = (color: string | null) =>
  TONE_BY_COLOR[(color ?? '').toUpperCase()] ?? 'olive';

const getTimeText = (date: string, allDay: boolean | null) => {
  if (allDay) {
    return null;
  }

  return format(new Date(date), 'HH:mm');
};

const CalendarWorkspace = ({
  blocks,
  onDeleteBlock,
  onSaveBlock,
}: CalendarWorkspaceProps) => {
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [editingBlock, setEditingBlock] = useState<CalendarBlockRow | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [note, setNote] = useState('');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(toLocalInputDate(new Date()));
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [visibleMonth]);

  const openEditor = (date = new Date(), block?: CalendarBlockRow) => {
    setEditingBlock(block ?? null);
    setTitle(block?.title ?? '');
    setNote(block?.note ?? '');
    setSelectedDate(toLocalInputDate(block ? new Date(block.start_date) : date));
    setTime(getTimeText(block?.start_date ?? date.toISOString(), block?.all_day ?? false) ?? '');
    setEditorOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    const startDate = new Date(`${selectedDate}T${time || '00:00'}:00`);
    onSaveBlock({
      allDay: !time,
      color: editingBlock?.color ?? '#66705A',
      id: editingBlock?.id ?? createUuid(),
      note: note.trim() || null,
      order: editingBlock?.order ?? 0,
      startDate: startDate.toISOString(),
      title: title.trim() || '새 일정',
    });
    setEditorOpen(false);
  };

  return (
    <div className="calendar-layout">
      <div className="mode-switch">
        <button
          className={mode === 'month' ? 'active' : ''}
          onClick={() => setMode('month')}
          type="button"
        >
          월별
        </button>
        <button
          className={mode === 'week' ? 'active' : ''}
          onClick={() => setMode('week')}
          type="button"
        >
          이번주 블록
        </button>
      </div>

      {mode === 'month' ? (
        <div className="month-card">
          <div className="week-header">
            <button
              className="icon-button"
              onClick={() => setVisibleMonth(date => addMonths(date, -1))}
              type="button"
            >
              <ChevronLeft size={20} />
            </button>
            <h2>{format(visibleMonth, 'yyyy년 M월')}</h2>
            <button
              className="icon-button"
              onClick={() => setVisibleMonth(date => addMonths(date, 1))}
              type="button"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="month-week-row">
            {['일', '월', '화', '수', '목', '금', '토'].map(day => (
              <strong key={day}>{day}</strong>
            ))}
          </div>
          <div className="month-grid">
            {monthDays.map(date => {
              const dayBlocks = blocks
                .filter(block => isSameDay(new Date(block.start_date), date))
                .sort(
                  (a, b) =>
                    new Date(a.start_date).getTime() -
                    new Date(b.start_date).getTime(),
                );

              return (
                <button
                  className={
                    isSameMonth(date, visibleMonth)
                      ? 'month-cell'
                      : 'month-cell muted'
                  }
                  key={date.toISOString()}
                  onClick={() => setSelectedDay(date)}
                  type="button"
                >
                  <span>{format(date, 'd')}</span>
                  {dayBlocks.slice(0, 3).map(block => (
                    <em className={`tone-${getTone(block.color)}`} key={block.id}>
                      {getTimeText(block.start_date, block.all_day)
                        ? `${getTimeText(block.start_date, block.all_day)} `
                        : ''}
                      {block.title}
                    </em>
                  ))}
                  {dayBlocks.length > 3 && <small>+{dayBlocks.length - 3}</small>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="week-card">
        <div className="week-header">
          <button
            className="icon-button"
            onClick={() => setAnchorDate(date => subDays(date, 7))}
            type="button"
          >
            <ChevronLeft size={20} />
          </button>
          <h2>{getWeekLabel(anchorDate)}</h2>
          <button
            className="icon-button"
            onClick={() => setAnchorDate(date => addDays(date, 7))}
            type="button"
          >
            <ChevronRight size={20} />
          </button>
          <button className="pill-button" onClick={() => openEditor()} type="button">
            <Plus size={16} />
            블럭 추가
          </button>
        </div>

        <div className="week-grid">
          {weekDates.map((date, index) => {
            const dayBlocks = blocks
              .filter(block => isSameDay(new Date(block.start_date), date))
              .sort(
                (a, b) =>
                  new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
              );

            return (
              <section className="day-column" key={date.toISOString()}>
                <header>
                  <div>
                    <strong>{DAYS[index]}</strong>
                    <span>{format(date, 'M.d')}</span>
                  </div>
                  <button
                    className="tiny-add"
                    onClick={() => openEditor(date)}
                    type="button"
                  >
                    +
                  </button>
                </header>

                <div className="time-label-row">
                  {TIME_SLOTS.map(hour => (
                    <span key={hour}>{hour.toString().padStart(2, '0')}</span>
                  ))}
                </div>

                <div className="block-stack">
                  {dayBlocks.length === 0 && (
                    <button
                      className="empty-day"
                      onClick={() => openEditor(date)}
                      type="button"
                    >
                      일정 추가
                    </button>
                  )}
                  {dayBlocks.map(block => (
                    <article
                      className={`calendar-brick tone-${getTone(block.color)}`}
                      key={block.id}
                      onClick={() => openEditor(date, block)}
                    >
                      <div className="top-edge" />
                      <strong>
                        {getTimeText(block.start_date, block.all_day) && (
                          <span>{getTimeText(block.start_date, block.all_day)}</span>
                        )}
                        {block.title}
                      </strong>
                      <p>{block.note || '눌러서 메모 추가'}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      )}

      {isEditorOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="sheet-panel compact-sheet" onSubmit={submit}>
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Calendar Brick</p>
                <h2>{editingBlock ? '블럭 수정' : '블럭 추가'}</h2>
              </div>
              {editingBlock && (
                <button
                  className="icon-button danger"
                  onClick={() => {
                    onDeleteBlock(editingBlock.id);
                    setEditorOpen(false);
                  }}
                  type="button"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>

            <label>
              제목
              <input
                onChange={event => setTitle(event.target.value)}
                placeholder="일정 제목"
                value={title}
              />
            </label>
            <div className="form-grid">
              <label>
                날짜
                <input
                  onChange={event => setSelectedDate(event.target.value)}
                  type="date"
                  value={selectedDate}
                />
              </label>
              <label>
                시간
                <input
                  onChange={event => setTime(event.target.value)}
                  type="time"
                  value={time}
                />
              </label>
            </div>
            <label>
              메모
              <textarea
                onChange={event => setNote(event.target.value)}
                placeholder="세부 메모"
                value={note}
              />
            </label>
            <div className="sheet-actions">
              <button className="secondary-button" onClick={() => setEditorOpen(false)} type="button">
                취소
              </button>
              <button className="primary-button" type="submit">
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedDay && (
        <div className="modal-backdrop detail-backdrop" role="presentation">
          <section className="detail-panel">
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Day Schedule</p>
                <h2>{format(selectedDay, 'M월 d일')} 일정</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setSelectedDay(null)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="sheet-list">
              {blocks.filter(block =>
                isSameDay(new Date(block.start_date), selectedDay),
              ).length === 0 && (
                <p className="empty-text">등록된 일정 없음</p>
              )}
              {blocks
                .filter(block => isSameDay(new Date(block.start_date), selectedDay))
                .sort(
                  (a, b) =>
                    new Date(a.start_date).getTime() -
                    new Date(b.start_date).getTime(),
                )
                .map(block => (
                  <button
                    className="briefing-row"
                    key={block.id}
                    onClick={() => {
                      setSelectedDay(null);
                      openEditor(new Date(block.start_date), block);
                    }}
                    type="button"
                  >
                    <strong>
                      {getTimeText(block.start_date, block.all_day) ?? '종일'} ·{' '}
                      {block.title}
                    </strong>
                    <span>{block.note || '눌러서 메모 추가'}</span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CalendarWorkspace;
