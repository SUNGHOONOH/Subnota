import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { createUuid } from '../../lib/contentHash';
import {
  buildScheduleNote,
  getScheduleNoteText,
  parseScheduleNoteMemoId,
} from '../../lib/scheduleFromSelection';
import {
  CalendarBlockDraft,
  CalendarBlockRow,
  CalendarCategoryDraft,
  CalendarCategoryRow,
  ScheduleInboxRow,
} from '../../types';
import { toValidDate } from '../../lib/viewCrashGuards';
import {
  CALENDAR_BLOCK_DRAG_TYPE,
  type CalendarResizeEdge,
  DRAG_SNAP_MINUTES,
  DEFAULT_COLOR,
  EVENT_COMPACT_HEIGHT_PX,
  EVENT_MIN_HEIGHT_PX,
  EVENT_SINGLE_LINE_TIME_HEIGHT_PX,
  EVENT_TIME_HEIGHT_PX,
  formatPreviewDuration,
  formatCalendarDate as formatCalendarDateValue,
  formatCalendarTime as formatCalendarTimeValue,
  findAvailableDropStart as findAvailableDropStartFromBlocks,
  getCalendarDayLabels,
  getCalendarTitle,
  getCalendarWeekStartsOn,
  getDayEvents,
  getDayScheduleSuggestions,
  getRange,
  getRangeForBlock,
  getScheduleSuggestionTitle,
  getTone,
  getTimedEventsForDay,
  type CalendarDropPreview,
  type CalendarResizePreview,
  HOUR_HEIGHT,
  HOUR_MS,
  HOURS,
  layoutTimedItems,
  MIN_EVENT_MINUTES,
  MONTH_CELL_CHROME_HEIGHT,
  MONTH_ITEM_ROW_HEIGHT,
  MONTH_MAX_VISIBLE_ITEM_LIMIT,
  RESIZE_STEP_MINUTES,
  snapResizeMinutes,
  SCHEDULE_INBOX_DRAG_TYPE,
  timeGridOffset,
  type TimedCalendarItem,
  toLocalInputDate,
  dateAtDropOffset,
  movedStartMinutes,
  withMinutesOfDay,
  getBlockStart,
  resizeRangeAtEdge,
} from './calendarUtils';
import CalendarHeader, { type CalendarView } from './components/CalendarHeader';
import CalendarMonthTodoArea from './components/CalendarMonthTodoArea';
import CalendarMonthView from './components/CalendarMonthView';
import CalendarEventEditorModal from './components/CalendarEventEditorModal';
import { hasScheduledTime } from '../schedule/scheduleInboxUtils';
import {
  ANCHORED_MODAL_MIN_HEIGHT,
  getAnchoredPlacement,
} from '../../lib/anchoredPlacement';
import { getUiDateLocale, localize, useUiLanguage } from '../../lib/uiLanguage';

interface CalendarWorkspaceProps {
  blocks: CalendarBlockRow[];
  categories: CalendarCategoryRow[];
  isScheduleInboxOpen?: boolean;
  hasNewReport?: boolean;
  onCreateCategory: (
    draft: CalendarCategoryDraft,
  ) => Promise<CalendarCategoryRow | null>;
  onDeleteCategory: (categoryId: string) => Promise<boolean>;
  onDeleteBlock: (blockId: string) => void;
  onDeleteScheduleSuggestion?: (item: ScheduleInboxRow) => void;
  onDropScheduleInbox?: (itemId: string, startDate: Date) => void;
  onPlaceScheduleSuggestion?: (
    item: ScheduleInboxRow,
    overrides: {
      allDay: boolean;
      note: string | null;
      startDate: Date;
      title: string;
    },
  ) => void;
  onSaveBlock: (draft: CalendarBlockDraft) => void;
  onToggleScheduleInbox?: () => void;
  onOpenReport?: () => void;
  onToggleCompleted: (blockId: string) => void;
  scheduleSuggestions?: ScheduleInboxRow[];
}

const CalendarWorkspace = ({
  blocks,
  categories,
  isScheduleInboxOpen = false,
  hasNewReport = false,
  onCreateCategory,
  onDeleteCategory,
  onDeleteBlock,
  onDeleteScheduleSuggestion,
  onDropScheduleInbox,
  onPlaceScheduleSuggestion,
  onSaveBlock,
  onToggleScheduleInbox,
  onOpenReport,
  onToggleCompleted,
  scheduleSuggestions = [],
}: CalendarWorkspaceProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const dateLocale = getUiDateLocale(language);
  const weekStartsOn = useMemo(
    () => getCalendarWeekStartsOn(dateLocale, language),
    [dateLocale, language],
  );
  const dayLabels = useMemo(
    () => getCalendarDayLabels(dateLocale, weekStartsOn),
    [dateLocale, weekStartsOn],
  );
  const formatCalendarTime = useCallback(
    (date: Date) => formatCalendarTimeValue(dateLocale, date),
    [dateLocale],
  );
  const formatCalendarDate = useCallback(
    (date: Date) => formatCalendarDateValue(dateLocale, date),
    [dateLocale],
  );
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [isMonthTodoOverlayOpen, setMonthTodoOverlayOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  // 누른 일정의 화면 위치. 없으면(딥링크·할 일 패널 등) 가운데로 뜬다.
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  // 창 높이는 메모 길이에 따라 달라져 세로 정렬에 필요하다. 실측해서 쓴다.
  const [anchoredHeight, setAnchoredHeight] = useState(ANCHORED_MODAL_MIN_HEIGHT);
  const anchoredModalRef = useRef<HTMLFormElement>(null);

  const [isEditorOpen, setEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CalendarBlockRow | null>(
    null,
  );
  const [editingSuggestion, setEditingSuggestion] =
    useState<ScheduleInboxRow | null>(null);
  const [expandedAllDayDateKey, setExpandedAllDayDateKey] = useState<
    string | null
  >(null);
  const [monthVisibleItemLimit, setMonthVisibleItemLimit] = useState(3);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [sourceMemoId, setSourceMemoId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    toLocalInputDate(new Date()),
  );
  const [time, setTime] = useState('09:00');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [isCategoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryMenuMode, setCategoryMenuMode] = useState<'create' | 'list'>(
    'list',
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_COLOR);
  const [isCustomColorPickerOpen, setCustomColorPickerOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [calendarDropPreview, setCalendarDropPreview] =
    useState<CalendarDropPreview | null>(null);
  const [calendarResizePreview, setCalendarResizePreview] =
    useState<CalendarResizePreview | null>(null);
  const [singleLineTimedEventKeys, setSingleLineTimedEventKeys] = useState<
    Set<string>
  >(() => new Set());

  const monthGridRef = useRef<HTMLDivElement>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const draggedBlockRef = useRef<CalendarBlockRow | null>(null);
  const dragGrabMinutesRef = useRef(0);

  const monthDays = useMemo(
    () =>
      eachDayOfInterval({
        end: endOfWeek(endOfMonth(anchor), { weekStartsOn }),
        start: startOfWeek(startOfMonth(anchor), { weekStartsOn }),
      }),
    [anchor, weekStartsOn],
  );
  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        end: endOfWeek(anchor, { weekStartsOn }),
        start: startOfWeek(anchor, { weekStartsOn }),
      }),
    [anchor, weekStartsOn],
  );

  const title_ = useMemo(() => {
    return getCalendarTitle(anchor, view, dateLocale, weekStartsOn);
  }, [anchor, dateLocale, view, weekStartsOn]);

  // Scroll the time grid to the morning when entering the week view.
  useEffect(() => {
    if (view === 'month' || !timeGridRef.current) {
      return;
    }
    timeGridRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, [view]);

  useEffect(() => {
    const grid = timeGridRef.current;
    if (view !== 'week' || !grid) {
      setSingleLineTimedEventKeys((previous) =>
        previous.size ? new Set() : previous,
      );
      return undefined;
    }

    let frame = 0;
    const measureTitles = () => {
      frame = 0;
      const next = new Set<string>();
      grid
        .querySelectorAll<HTMLElement>('strong[data-calendar-event-key]')
        .forEach((title) => {
          const eventKey = title.dataset.calendarEventKey;
          const lineHeight = Number.parseFloat(
            window.getComputedStyle(title).lineHeight,
          );
          if (
            eventKey &&
            Number.isFinite(lineHeight) &&
            title.getBoundingClientRect().height <= lineHeight + 0.5
          ) {
            next.add(eventKey);
          }
        });

      setSingleLineTimedEventKeys((previous) => {
        if (
          previous.size === next.size &&
          Array.from(next).every((key) => previous.has(key))
        ) {
          return previous;
        }
        return next;
      });
    };
    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureTitles);
    };
    const observer = new ResizeObserver(scheduleMeasurement);
    observer.observe(grid);
    scheduleMeasurement();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [blocks, view, weekDays]);

  useEffect(() => {
    if (!isMonthTodoOverlayOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthTodoOverlayOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMonthTodoOverlayOpen]);

  useEffect(() => {
    if (!isCategoryMenuOpen) return;

    const closeMenu = () => {
      setCategoryMenuOpen(false);
      setCategoryMenuMode('list');
      setCustomColorPickerOpen(false);
      setDeleteCategoryId(null);
    };
    const dismissMenu = (event: PointerEvent) => {
      if (categoryPickerRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', dismissMenu);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissMenu);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [isCategoryMenuOpen]);

  useEffect(() => {
    const grid = monthGridRef.current;
    if (view !== 'month' || !grid) return;

    const updateVisibleItemLimit = () => {
      const weekCount = monthDays.length / 7;
      const cellHeight = grid.clientHeight / weekCount;
      const nextLimit = Math.max(
        1,
        Math.min(
          MONTH_MAX_VISIBLE_ITEM_LIMIT,
          Math.floor(
            (cellHeight - MONTH_CELL_CHROME_HEIGHT) / MONTH_ITEM_ROW_HEIGHT,
          ),
        ),
      );
      setMonthVisibleItemLimit(nextLimit);
    };

    updateVisibleItemLimit();
    const observer = new ResizeObserver(updateVisibleItemLimit);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [monthDays.length, view]);

  const move = (direction: -1 | 1) => {
    setAnchor((current) =>
      view === 'month'
        ? addMonths(current, direction)
        : addDays(current, direction * 7),
    );
  };

  const selectDay = (date: Date) => {
    setSelectedDay(date);
    setAnchor(date);
  };

  const openEditor = useCallback((
    date: Date,
    block?: CalendarBlockRow,
    anchor?: HTMLElement | null,
  ) => {
    setAnchorRect(anchor?.getBoundingClientRect() ?? null);
    setEditingBlock(block ?? null);
    setEditingSuggestion(null);
    setTitle(block?.title ?? '');
    setSourceMemoId(parseScheduleNoteMemoId(block?.note));
    setNote(getScheduleNoteText(block?.note));
    const base = block ? getBlockStart(block) : date;
    setSelectedDate(toLocalInputDate(base));
    setTime(block?.all_day ? '' : format(base, 'HH:mm'));
    setSelectedCategoryId(block?.category_id ?? null);
    setSelectedColor(block?.color ?? DEFAULT_COLOR);
    setCategoryMenuOpen(false);
    setCategoryMenuMode('list');
    setCustomColorPickerOpen(false);
    setDeleteCategoryId(null);
    setEditorOpen(true);
  }, []);

  const openSuggestionEditor = useCallback((
    item: ScheduleInboxRow,
    anchor?: HTMLElement | null,
  ) => {
    const scheduledAt = toValidDate(item.scheduled_at);
    if (!scheduledAt) return;

    setAnchorRect(anchor?.getBoundingClientRect() ?? null);
    setEditingBlock(null);
    setEditingSuggestion(item);
    setTitle(getScheduleSuggestionTitle(item, language));
    setSourceMemoId(item.memo_id);
    setNote(item.source_text);
    setSelectedDate(toLocalInputDate(scheduledAt));
    setTime(hasScheduledTime(item) ? format(scheduledAt, 'HH:mm') : '');
    setSelectedCategoryId(null);
    setSelectedColor(DEFAULT_COLOR);
    setCategoryMenuOpen(false);
    setCustomColorPickerOpen(false);
    setEditorOpen(true);
  }, [language]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingSuggestion(null);
    setCategoryMenuOpen(false);
    setCustomColorPickerOpen(false);
    setAnchorRect(null);
  }, []);

  /**
   * 누른 일정 옆에 창을 붙인다. 오른쪽을 먼저 보고, 자리가 없으면 왼쪽으로
   * 뒤집는다. 양쪽 다 안 되면(좁은 창) 앵커를 포기하고 가운데로 돌아간다 —
   * 억지로 붙이면 창이 화면 밖으로 나간다.
   *
   * 세로는 앵커 가운데에 맞추되 뷰포트 안으로 자르고, 꼬리는 잘린 만큼
   * 되돌려 실제 앵커를 계속 가리키게 한다.
   */
  const anchoredPlacement = useMemo(
    () => getAnchoredPlacement(anchorRect, anchoredHeight),
    [anchorRect, anchoredHeight],
  );

  // 메모가 길어지면 창도 길어진다. 높이를 모른 채 세로 가운데를 맞추면
  // 앵커에서 어긋나므로 실측해서 배치에 반영한다.
  useEffect(() => {
    const node = anchoredModalRef.current;
    if (!isEditorOpen || !anchorRect || !node) return undefined;

    const observer = new ResizeObserver(() => {
      setAnchoredHeight(node.offsetHeight || ANCHORED_MODAL_MIN_HEIGHT);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [anchorRect, isEditorOpen]);

  // Esc로 닫는다. 다만 안쪽에 열린 것이 있으면 그것이 먼저 닫혀야 한다 —
  // 카테고리 메뉴를 닫으려고 누른 Esc에 편집 창까지 사라지면, 고르던 것을
  // 취소한 것이 아니라 쓰던 것을 잃는다.
  useEffect(() => {
    if (!isEditorOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isCategoryMenuOpen) return;
      closeEditor();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeEditor, isCategoryMenuOpen, isEditorOpen]);

  useEffect(() => {
    const handleOpenCalendarBlock = (event: Event) => {
      const { blockId } = (event as CustomEvent<{ blockId?: string }>)
        .detail ?? { blockId: undefined };
      const block = blocks.find((candidate) => candidate.id === blockId);
      if (!block) return;
      const date = getBlockStart(block);
      setAnchor(date);
      setSelectedDay(date);
      openEditor(date, block);
    };

    window.addEventListener(
      'subnota:open-calendar-block',
      handleOpenCalendarBlock,
    );
    return () =>
      window.removeEventListener(
        'subnota:open-calendar-block',
        handleOpenCalendarBlock,
      );
  }, [blocks, openEditor]);

  useEffect(() => {
    const handleOpenSuggestion = (event: Event) => {
      const { itemId } = (event as CustomEvent<{ itemId?: string }>).detail ?? {
        itemId: undefined,
      };
      const suggestion = scheduleSuggestions.find((item) => item.id === itemId);
      if (!suggestion) return;
      const date = toValidDate(suggestion.scheduled_at);
      if (!date) return;
      setAnchor(date);
      setSelectedDay(date);
      openSuggestionEditor(suggestion);
    };

    window.addEventListener(
      'subnota:open-schedule-suggestion',
      handleOpenSuggestion,
    );
    return () =>
      window.removeEventListener(
        'subnota:open-schedule-suggestion',
        handleOpenSuggestion,
      );
  }, [openSuggestionEditor, scheduleSuggestions]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // 사용자가 명시적으로 입력한 시각은 스냅하지 않는다. 스냅은 드래그·리사이즈
    // 같은 마우스 조작에만 적용한다.
    const startDate = new Date(`${selectedDate}T${time || '00:00'}:00`);
    if (editingSuggestion) {
      onPlaceScheduleSuggestion?.(editingSuggestion, {
        allDay: !time,
        note: note.trim() || null,
        startDate,
        title: title.trim() || getScheduleSuggestionTitle(editingSuggestion, language),
      });
      setEditorOpen(false);
      setEditingSuggestion(null);
      return;
    }

    const previousRange = editingBlock ? getRange(editingBlock) : null;
    const duration = previousRange
      ? Math.max(
          MIN_EVENT_MINUTES * 60_000,
          previousRange.end.getTime() - previousRange.start.getTime(),
        )
      : HOUR_MS;
    onSaveBlock({
      allDay: !time,
      categoryId: selectedCategoryId,
      color: selectedColor,
      endDate: time
        ? new Date(startDate.getTime() + duration).toISOString()
        : null,
      id: editingBlock?.id ?? createUuid(),
      note: buildScheduleNote(note.trim(), sourceMemoId).trim() || null,
      order: editingBlock?.order ?? 0,
      startDate: startDate.toISOString(),
      title: title.trim() || t('새 일정', 'New event'),
    });
    setEditorOpen(false);
  };

  const selectCategory = (category: CalendarCategoryRow | null) => {
    setSelectedCategoryId(category?.id ?? null);
    setSelectedColor(category?.color ?? DEFAULT_COLOR);
    setDeleteCategoryId(null);
    setCategoryMenuOpen(false);
    setCategoryMenuMode('list');
  };

  const createCategory = async () => {
    const category = await onCreateCategory({
      color: newCategoryColor,
      name: newCategoryName,
    });
    if (!category) return;
    setNewCategoryName('');
    selectCategory(category);
  };

  const deleteCategory = async () => {
    if (!deleteCategoryId) return;
    const deleted = await onDeleteCategory(deleteCategoryId);
    if (!deleted) return;
    if (selectedCategoryId === deleteCategoryId) {
      setSelectedCategoryId(null);
      setSelectedColor(DEFAULT_COLOR);
    }
    setDeleteCategoryId(null);
  };

  // Keep these local wrappers so event handlers and JSX retain their existing
  // closure shape while the data projection rules live in calendarUtils.
  const dayEvents = (date: Date) => getDayEvents(blocks, date);
  const rangeForBlock = (block: CalendarBlockRow) =>
    getRangeForBlock(block, calendarResizePreview);
  const timedEventsForDay = (date: Date): TimedCalendarItem[] =>
    getTimedEventsForDay(blocks, date, calendarResizePreview);
  const dayScheduleSuggestions = (date: Date) =>
    getDayScheduleSuggestions(scheduleSuggestions, date);
  const findAvailableDropStart = (
    requestedStart: Date,
    durationMs: number,
    excludeBlockId?: string,
  ) =>
    findAvailableDropStartFromBlocks(
      blocks,
      requestedStart,
      durationMs,
      excludeBlockId,
    );

  // Week-view drag-and-drop: native HTML5 drag moves an event to the dropped
  // day+hour. Dropping an all-day event here also gives it that time.
  const startDrag = (event: React.DragEvent, block: CalendarBlockRow) => {
    draggedBlockRef.current = block;
    // 블록 안에서 잡은 지점(분). 드롭 때 이걸 빼야 커서가 아니라 잡은 자리가
    // 유지된다 — 안 그러면 가운데를 잡아도 시작 시각이 커서로 끌려간다.
    const rect = event.currentTarget.getBoundingClientRect();
    dragGrabMinutesRef.current =
      ((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
    event.dataTransfer.setData(CALENDAR_BLOCK_DRAG_TYPE, block.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  // 드롭 지점 → 시작 시각. 기존 일정은 델타 스냅(오프셋 보존), 새 항목은
  // 기준 시각이 없으므로 절대 스냅. Shift를 누르면 스냅을 끈다.
  const dropStartAt = (
    event: React.DragEvent,
    date: Date,
    block: CalendarBlockRow | null,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const step = event.shiftKey ? 1 : DRAG_SNAP_MINUTES;
    if (!block) {
      return dateAtDropOffset(date, offsetY, HOUR_HEIGHT, step);
    }
    const start = getBlockStart(block);
    return withMinutesOfDay(
      date,
      movedStartMinutes(
        (offsetY / HOUR_HEIGHT) * 60,
        dragGrabMinutesRef.current,
        start.getHours() * 60 + start.getMinutes(),
        step,
      ),
    );
  };

  const dragOverColumn = (event: React.DragEvent, date: Date) => {
    const types = Array.from(event.dataTransfer.types);
    const isCalendarBlock = types.includes(CALENDAR_BLOCK_DRAG_TYPE);
    const isScheduleInbox = types.includes(SCHEDULE_INBOX_DRAG_TYPE);
    if (!isCalendarBlock && !isScheduleInbox) {
      return;
    }

    event.preventDefault();
    const draggedBlock = isCalendarBlock ? draggedBlockRef.current : null;
    const requestedStart = dropStartAt(event, date, draggedBlock);
    let durationMs = HOUR_MS;
    if (draggedBlock) {
      const { end, start: blockStart } = getRange(draggedBlock);
      durationMs = Math.max(60_000, end.getTime() - blockStart.getTime());
    }
    const start = findAvailableDropStart(
      requestedStart,
      durationMs,
      draggedBlock?.id,
    );
    event.dataTransfer.dropEffect = start ? 'move' : 'none';

    setCalendarDropPreview({
      dateKey: date.toISOString(),
      durationMs,
      isAvailable: Boolean(start),
      start: start ?? requestedStart,
      title: draggedBlock?.title || t('일정 배치', 'Place event'),
    });
  };

  const leaveColumn = (event: React.DragEvent) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    setCalendarDropPreview(null);
  };

  const dropOnColumn = (event: React.DragEvent, date: Date) => {
    event.preventDefault();
    const scheduleInboxId = event.dataTransfer.getData(
      SCHEDULE_INBOX_DRAG_TYPE,
    );
    const draggedBlock = scheduleInboxId
      ? null
      : (blocks.find(
          (item) =>
            item.id === event.dataTransfer.getData(CALENDAR_BLOCK_DRAG_TYPE),
        ) ?? draggedBlockRef.current);
    const requestedStart = dropStartAt(event, date, draggedBlock);
    let durationMs = HOUR_MS;
    if (draggedBlock) {
      const { end, start } = getRange(draggedBlock);
      durationMs = Math.max(60_000, end.getTime() - start.getTime());
    }
    const next = findAvailableDropStart(
      requestedStart,
      durationMs,
      draggedBlock?.id,
    );

    draggedBlockRef.current = null;
    setCalendarDropPreview(null);
    if (!next) return;
    if (scheduleInboxId) {
      onDropScheduleInbox?.(scheduleInboxId, next);
      return;
    }

    if (!draggedBlock) {
      return;
    }
    onSaveBlock({
      allDay: false,
      categoryId: draggedBlock.category_id ?? null,
      color: draggedBlock.color ?? DEFAULT_COLOR,
      endDate: new Date(next.getTime() + durationMs).toISOString(),
      id: draggedBlock.id,
      note: draggedBlock.note,
      order: draggedBlock.order ?? 0,
      startDate: next.toISOString(),
      title: draggedBlock.title,
    });
  };

  const dayAtPointerX = (clientX: number) => {
    const columns = Array.from(
      timeGridRef.current?.querySelectorAll<HTMLElement>(
        '[data-calendar-day]',
      ) ?? [],
    );
    if (columns.length === 0) return null;

    const column =
      columns.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right;
      }) ??
      (clientX < columns[0].getBoundingClientRect().left
        ? columns[0]
        : columns[columns.length - 1]);
    const dateKey = column.dataset.calendarDay;
    return (
      weekDays.find((day) => format(day, 'yyyy-MM-dd') === dateKey) ?? null
    );
  };

  const resizeBlock = (
    event: React.PointerEvent,
    block: CalendarBlockRow,
    edge: CalendarResizeEdge,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    // Capture the pointer so the synthetic click after pointerup targets this
    // handle (whose onClick stops propagation) instead of the event <button>.
    // Without this, shrinking ends the drag inside the button and the click
    // opens the detail editor; growing ends outside and doesn't.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor =
      edge === 'left' || edge === 'right' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';

    const startY = event.clientY;
    const { end, start } = getRange(block);
    const minMs = MIN_EVENT_MINUTES * 60_000;
    let previewKey = '';

    const nextRangeAtPointer = (
      clientX: number,
      clientY: number,
      shiftKey: boolean,
    ) => {
      if (edge === 'left' || edge === 'right') {
        const targetDay = dayAtPointerX(clientX);
        const originalBoundary = edge === 'left' ? start : end;
        if (!targetDay) return { end, start };

        const nextBoundary = new Date(targetDay);
        nextBoundary.setHours(
          originalBoundary.getHours(),
          originalBoundary.getMinutes(),
          originalBoundary.getSeconds(),
          originalBoundary.getMilliseconds(),
        );
        return resizeRangeAtEdge(start, end, edge, nextBoundary, minMs);
      }

      const deltaMs =
        snapResizeMinutes(
          clientY - startY,
          shiftKey ? 1 : RESIZE_STEP_MINUTES,
        ) * 60_000;
      const nextBoundary = new Date(
        (edge === 'top' ? start : end).getTime() + deltaMs,
      );
      return resizeRangeAtEdge(start, end, edge, nextBoundary, minMs);
    };

    const preview = (next: { end: Date; start: Date }) => {
      const key = `${next.start.getTime()}:${next.end.getTime()}`;
      if (key === previewKey) return;
      previewKey = key;
      if (
        next.start.getTime() === start.getTime() &&
        next.end.getTime() === end.getTime()
      ) {
        setCalendarResizePreview(null);
        return;
      }
      setCalendarResizePreview({
        blockId: block.id,
        end: next.end,
        start: next.start,
      });
    };

    const finish = (clientX: number, clientY: number, shiftKey: boolean) => {
      const { end: nextEnd, start: nextStart } = nextRangeAtPointer(
        clientX,
        clientY,
        shiftKey,
      );
      if (
        nextStart.getTime() === start.getTime() &&
        nextEnd.getTime() === end.getTime()
      ) {
        return;
      }

      onSaveBlock({
        allDay: false,
        categoryId: block.category_id ?? null,
        color: block.color ?? DEFAULT_COLOR,
        endDate: nextEnd.toISOString(),
        id: block.id,
        note: block.note,
        order: block.order ?? 0,
        startDate: nextStart.toISOString(),
        title: block.title,
      });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('blur', cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setCalendarResizePreview(null);
    };

    const onPointerMove = (pointerEvent: PointerEvent) => {
      preview(
        nextRangeAtPointer(
          pointerEvent.clientX,
          pointerEvent.clientY,
          pointerEvent.shiftKey,
        ),
      );
    };

    const onPointerUp = (pointerEvent: PointerEvent) => {
      window.removeEventListener('pointerup', onPointerUp);
      finish(pointerEvent.clientX, pointerEvent.clientY, pointerEvent.shiftKey);
      cleanup();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('blur', cleanup);
  };

  const renderTimeGrid = () => {
    const now = new Date();
    return (
      <div className="cal-timegrid-wrap view-week">
        <div className="cal-timegrid-head">
          <div className="cal-time-gutter-head" />
          {weekDays.map((date) => (
            <div
              className={`cal-col-head${isToday(date) ? ' today' : ''}${
                isSameDay(date, selectedDay) ? ' selected' : ''
              }`}
              key={date.toISOString()}
              onClick={() => setSelectedDay(date)}
              role="button"
              tabIndex={0}
            >
              <span className="cal-col-dow">
                {new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(date)}
              </span>
              <span className="cal-col-date">{date.getDate()}</span>
            </div>
          ))}
        </div>

        <div
          className={`cal-allday-row${
            expandedAllDayDateKey &&
            weekDays.some(
              (date) => format(date, 'yyyy-MM-dd') === expandedAllDayDateKey,
            )
              ? ' expanded'
              : ''
          }`}
        >
          <div className="cal-time-gutter-head all">{t('종일', 'All day')}</div>
          {weekDays.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const allDayItems = [
              ...dayScheduleSuggestions(date)
                .filter((item) => !hasScheduledTime(item))
                .map((suggestion) => ({
                  kind: 'suggestion' as const,
                  suggestion,
                })),
              ...dayEvents(date)
                .filter((block) => block.all_day)
                .map((block) => ({ block, kind: 'block' as const })),
            ];
            const isExpanded = expandedAllDayDateKey === dateKey;
            const visibleItems = isExpanded
              ? allDayItems
              : allDayItems.length > 2
                ? allDayItems.slice(0, 1)
                : allDayItems;
            const hiddenCount = allDayItems.length - visibleItems.length;

            return (
              <div className="cal-allday-cell" key={date.toISOString()}>
                {visibleItems.map((item) => {
                  if (item.kind === 'block') {
                    const { block } = item;
                    const tone = getTone(block.color);
                    return (
                      <button
                        className={`cal-allday-event${block.is_completed ? ' completed' : ''}`}
                        draggable
                        key={block.id}
                        onClick={(event) =>
                          openEditor(date, block, event.currentTarget)
                        }
                        onDragEnd={() => {
                          draggedBlockRef.current = null;
                          setCalendarDropPreview(null);
                        }}
                        onDragStart={(event) => startDrag(event, block)}
                        style={{ backgroundColor: tone.bg, color: tone.text }}
                        type="button"
                      >
                        <span
                          className="cal-chip-dot"
                          style={{ background: tone.accent }}
                        />
                        <span
                          className="cal-allday-event-title"
                          title={block.title}
                        >
                          {block.title}
                        </span>
                      </button>
                    );
                  }

                  const { suggestion } = item;
                  const suggestionTitle =
                    getScheduleSuggestionTitle(suggestion, language);
                  return (
                    <button
                      aria-label={t(
                        `${suggestionTitle} 일정 제안, 시간 미정. 눌러서 등록`,
                        `${suggestionTitle} schedule suggestion, time not set. Select to add.`,
                      )}
                      className="cal-allday-event cal-suggestion-event cal-suggestion-allday"
                      key={`suggestion:${suggestion.id}`}
                      onClick={(event) =>
                        openSuggestionEditor(suggestion, event.currentTarget)
                      }
                      type="button"
                    >
                      <span className="cal-suggestion-copy">
                        <span
                          className="cal-allday-event-title"
                          title={suggestionTitle}
                        >
                          {suggestionTitle}
                        </span>
                        <span className="cal-suggestion-meta">{t('시간 미정', 'Time not set')}</span>
                      </span>
                      <span aria-hidden="true" className="cal-suggestion-cta">
                        <b>＋</b>
                        <span className="cal-suggestion-cta-label">{t('등록', 'Add')}</span>
                      </span>
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    className="cal-allday-more"
                    onClick={() => setExpandedAllDayDateKey(dateKey)}
                    type="button"
                  >
                    {t(`+${hiddenCount}개`, `+${hiddenCount}`)}
                  </button>
                )}
                {isExpanded && allDayItems.length > 2 && (
                  <button
                    className="cal-allday-more"
                    onClick={() => setExpandedAllDayDateKey(null)}
                    type="button"
                  >
                    {t('접기', 'Collapse')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="cal-timegrid-scroll" ref={timeGridRef}>
          <div className="cal-timegrid-body">
            <div className="cal-time-gutter">
              {HOURS.map((hour) => (
                <div
                  className="cal-hour-label"
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                >
                  {hour === 0
                    ? ''
                    : new Intl.DateTimeFormat(dateLocale, {
                        hour: 'numeric',
                      }).format(new Date(2024, 0, 1, hour))}
                </div>
              ))}
            </div>
            {weekDays.map((date, dayIndex) => {
              const timedBlocks = timedEventsForDay(date);
              const timedSuggestions: TimedCalendarItem[] =
                dayScheduleSuggestions(date)
                  .filter(hasScheduledTime)
                  .flatMap((suggestion) => {
                    const start = toValidDate(suggestion.scheduled_at);
                    return start
                      ? [
                          {
                            block: null,
                            daySpan: 1,
                            end: new Date(start.getTime() + HOUR_MS),
                            start,
                            suggestion,
                          },
                        ]
                      : [];
                  });
              const laid = layoutTimedItems([
                ...timedBlocks,
                ...timedSuggestions,
              ]);
              return (
                <div
                  className={`cal-day-col${
                    calendarDropPreview?.dateKey === date.toISOString()
                      ? ` drop-target${calendarDropPreview.isAvailable ? '' : ' unavailable'}`
                      : ''
                  }`}
                  data-calendar-day={format(date, 'yyyy-MM-dd')}
                  key={date.toISOString()}
                  onDragLeave={leaveColumn}
                  onDragOver={(event) => dragOverColumn(event, date)}
                  onDrop={(event) => dropOnColumn(event, date)}
                >
                  {HOURS.map((hour) => (
                    <div
                      className="cal-hour-cell"
                      key={hour}
                      onClick={(event) => {
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        const target = dateAtDropOffset(
                          date,
                          hour * HOUR_HEIGHT + event.clientY - rect.top,
                          HOUR_HEIGHT,
                        );
                        setSelectedDay(date);
                        // 빈 칸은 한 시간 전체라 앵커로 삼으면 창이 엉뚱한
                        // 높이에 붙는다. 실제로 누른 지점만 가리킨다.
                        openEditor(target, undefined, {
                          getBoundingClientRect: () =>
                            new DOMRect(rect.left, event.clientY, rect.width, 1),
                        } as HTMLElement);
                      }}
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}
                  {isToday(date) && (
                    <div
                      className="cal-now-line"
                      style={{
                        top:
                          (now.getHours() + now.getMinutes() / 60) *
                          HOUR_HEIGHT,
                      }}
                    />
                  )}
                  {calendarDropPreview?.dateKey === date.toISOString() && (
                    <div
                      className={`cal-schedule-drop-preview${
                        calendarDropPreview.isAvailable ? '' : ' unavailable'
                      }`}
                      style={{
                        height: Math.max(
                          EVENT_MIN_HEIGHT_PX,
                          (calendarDropPreview.durationMs / HOUR_MS) *
                            HOUR_HEIGHT -
                            2,
                        ),
                        top: timeGridOffset(calendarDropPreview.start),
                      }}
                    >
                      <strong>
                        {calendarDropPreview.isAvailable
                          ? calendarDropPreview.title
                          : t('빈 시간이 없습니다', 'No available time')}
                      </strong>
                      <span>
                        {calendarDropPreview.isAvailable
                          ? `${formatCalendarTime(calendarDropPreview.start)} · ${formatPreviewDuration(calendarDropPreview.durationMs, language)}`
                          : t('겹치는 일정이 있어 이동하지 않습니다', 'This overlaps another event, so it cannot be moved')}
                      </span>
                    </div>
                  )}
                  {laid.map(
                    ({
                      block,
                      suggestion,
                      start,
                      end,
                      daySpan,
                      stackCount,
                      stackIndex,
                      stackRowHeight,
                      stackStart,
                      overflowCount,
                    }) => {
                      const isStacked = stackCount > 1;
                      const topDate = isStacked ? stackStart : start;
                      const top = timeGridOffset(topDate);
                      const minutes = Math.max(
                        1,
                        (end.getTime() - start.getTime()) / 60000,
                      );
                      // 높이만 하한을 두고 시각·정렬은 실제 길이를 따른다.
                      const blockHeight = Math.max(
                        EVENT_MIN_HEIGHT_PX,
                        (minutes / 60) * HOUR_HEIGHT - 2,
                      );
                      const isCompact =
                        isStacked || blockHeight <= EVENT_COMPACT_HEIGHT_PX;
                      const eventKey = `${block?.id ?? suggestion?.id}:${date.toISOString()}`;
                      // 45·60분 카드는 실제 제목이 한 줄일 때만 시간을 붙인다.
                      // 창 폭 변화로 줄바꿈이 생기면 ResizeObserver가 다시 판단한다.
                      const showsTime =
                        !isStacked &&
                        (blockHeight >= EVENT_TIME_HEIGHT_PX ||
                          (blockHeight >= EVENT_SINGLE_LINE_TIME_HEIGHT_PX &&
                            singleLineTimedEventKeys.has(eventKey)));
                      // 최저 높이에 붙은 초단기 일정만 기존의 좁은 리사이즈 핸들을 쓴다.
                      // 45분짜리 제목 한 줄 카드는 이동/리사이즈 hit area를 그대로 둔다.
                      const isResizeCompact =
                        isStacked || blockHeight <= EVENT_MIN_HEIGHT_PX + 6;
                      const compactClassName = `${isCompact ? ' compact' : ''}${
                        isResizeCompact ? ' compact-resize' : ''
                      }${showsTime ? ' roomy' : ''}`;
                      const spanDays = Math.min(
                        daySpan,
                        weekDays.length - dayIndex,
                      );
                      const layoutStyle = {
                        height: isStacked
                          ? Math.max(1, stackRowHeight - 1)
                          : blockHeight,
                        left: '2px',
                        top: isStacked
                          ? top + stackIndex * stackRowHeight
                          : top,
                        width: 'calc(100% - 4px)',
                        zIndex: daySpan > 1 ? 3 : 2,
                      };
                      if (spanDays > 1) {
                        layoutStyle.width = `calc(${spanDays * 100}% - 4px)`;
                      }

                      if (suggestion) {
                        const suggestionTitle =
                          getScheduleSuggestionTitle(suggestion, language);
                        return (
                          <button
                            aria-label={t(
                              `${suggestionTitle} 일정 제안, ${formatCalendarTime(start)}${overflowCount > 0 ? `, ${overflowCount}개 일정 더 있음` : ''}. 눌러서 등록`,
                              `${suggestionTitle} schedule suggestion, ${formatCalendarTime(start)}${overflowCount > 0 ? `, ${overflowCount} more events` : ''}. Select to add.`,
                            )}
                            className={`cal-event cal-suggestion-event${compactClassName}`}
                            key={`suggestion:${suggestion.id}`}
                            onClick={(event) =>
                              openSuggestionEditor(suggestion, event.currentTarget)
                            }
                            style={layoutStyle}
                            type="button"
                          >
                            <span className="cal-suggestion-copy">
                              <strong title={suggestionTitle}>
                                {suggestionTitle}
                              </strong>
                              {overflowCount > 0 && (
                                <span className="cal-event-more">
                                  {t(`+${overflowCount}개`, `+${overflowCount}`)}
                                </span>
                              )}
                              <span>{formatCalendarTime(start)} · {t('제안', 'Suggestion')}</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="cal-suggestion-cta"
                            >
                              <b>＋</b>
                              <span className="cal-suggestion-cta-label">
                                {t('등록', 'Add')}
                              </span>
                            </span>
                          </button>
                        );
                      }

                      if (!block) return null;
                      const tone = getTone(block.color);
                      const blockRange = rangeForBlock(block);
                      const isSpanOrigin = isSameDay(blockRange.start, date);
                      const canResizeFromLeft = isSpanOrigin;
                      const canResizeFromRight = isSpanOrigin;
                      const spansMultipleDays = daySpan > 1;
                      return (
                        <button
                          aria-label={`${block.title}, ${formatCalendarTime(start)}${overflowCount > 0 ? t(`, ${overflowCount}개 일정 더 있음`, `, ${overflowCount} more events`) : ''}`}
                          className={`cal-event${block.is_completed ? ' completed' : ''}${compactClassName}`}
                          draggable={!spansMultipleDays}
                          key={block.id}
                          onClick={(event) =>
                            openEditor(date, block, event.currentTarget)
                          }
                          onDragEnd={() => {
                            draggedBlockRef.current = null;
                            setCalendarDropPreview(null);
                          }}
                          onDragStart={(event) => startDrag(event, block)}
                          style={{
                            backgroundColor: tone.bg,
                            borderLeft: `3px solid ${tone.accent}`,
                            color: tone.text,
                            ...layoutStyle,
                          }}
                          type="button"
                        >
                          {canResizeFromLeft && (
                            <span
                              aria-hidden="true"
                              className="cal-event-resize left"
                              draggable={false}
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) =>
                                resizeBlock(event, block, 'left')
                              }
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className="cal-event-resize top"
                            draggable={false}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) =>
                              resizeBlock(event, block, 'top')
                            }
                          />
                          <strong data-calendar-event-key={eventKey}>
                            {block.title}
                          </strong>
                          {overflowCount > 0 && (
                            <span className="cal-event-more">
                              {t(`+${overflowCount}개`, `+${overflowCount}`)}
                            </span>
                          )}
                          <span className="cal-event-time">
                            {formatCalendarTime(start)}
                          </span>
                          <span
                            aria-hidden="true"
                            className="cal-event-resize bottom"
                            draggable={false}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) =>
                              resizeBlock(event, block, 'bottom')
                            }
                          />
                          {canResizeFromRight && (
                            <span
                              aria-hidden="true"
                              className="cal-event-resize right"
                              draggable={false}
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) =>
                                resizeBlock(event, block, 'right')
                              }
                            />
                          )}
                        </button>
                      );
                    },
                  )}
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
        <CalendarHeader
          hasNewReport={hasNewReport}
          isScheduleInboxOpen={isScheduleInboxOpen}
          language={language}
          onChangeView={key => {
            setView(key);
            if (key !== 'month') setMonthTodoOverlayOpen(false);
          }}
          onNext={() => move(1)}
          onOpenReport={onOpenReport}
          onPrevious={() => move(-1)}
          onToday={() => {
            setAnchor(new Date());
            setSelectedDay(new Date());
          }}
          onToggleScheduleInbox={onToggleScheduleInbox}
          title={title_}
          view={view}
        />

        {view === 'month' ? (
          <CalendarMonthView
            anchor={anchor}
            dayEvents={dayEvents}
            dayLabels={dayLabels}
            dayScheduleSuggestions={dayScheduleSuggestions}
            formatCalendarDate={formatCalendarDate}
            formatCalendarTime={formatCalendarTime}
            language={language}
            monthDays={monthDays}
            monthGridRef={monthGridRef}
            monthVisibleItemLimit={monthVisibleItemLimit}
            onOpenEditor={openEditor}
            onOpenSuggestionEditor={openSuggestionEditor}
            onSelectDay={selectDay}
            selectedDay={selectedDay}
            t={t}
            weekStartsOn={weekStartsOn}
          />
        ) : (
          renderTimeGrid()
        )}
      </div>

      {view === 'month' && (
        <CalendarMonthTodoArea
          blocks={dayEvents(selectedDay)}
          date={selectedDay}
          detailAriaLabel={t(
            `${formatCalendarDate(selectedDay)} 할 일 상세`,
            `${formatCalendarDate(selectedDay)} to-do details`,
          )}
          isDetailOpen={isMonthTodoOverlayOpen}
          onAdd={() => openEditor(selectedDay)}
          onEdit={(block) => openEditor(getBlockStart(block), block)}
          onToggleDetail={() => setMonthTodoOverlayOpen((isOpen) => !isOpen)}
          onToggle={onToggleCompleted}
          shouldReduceMotion={shouldReduceMotion}
        />
      )}

      <CalendarEventEditorModal
        anchoredModalRef={anchoredModalRef}
        anchoredPlacement={anchoredPlacement}
        categories={categories}
        categoryMenuMode={categoryMenuMode}
        categoryPickerRef={categoryPickerRef}
        deleteCategoryId={deleteCategoryId}
        editingBlock={editingBlock}
        editingSuggestion={editingSuggestion}
        isCategoryMenuOpen={isCategoryMenuOpen}
        isCustomColorPickerOpen={isCustomColorPickerOpen}
        isEditorOpen={isEditorOpen}
        newCategoryColor={newCategoryColor}
        newCategoryName={newCategoryName}
        note={note}
        onCancel={() => {
          setEditorOpen(false);
          setEditingSuggestion(null);
        }}
        onChangeCategoryMenuMode={setCategoryMenuMode}
        onChangeCustomColorPickerOpen={setCustomColorPickerOpen}
        onChangeDateTime={(date, allDay) => {
          setSelectedDate(toLocalInputDate(date));
          setTime(allDay ? '' : format(date, 'HH:mm'));
        }}
        onChangeDeleteCategoryId={setDeleteCategoryId}
        onChangeNewCategoryColor={setNewCategoryColor}
        onChangeNewCategoryName={setNewCategoryName}
        onChangeNote={setNote}
        onChangeTitle={setTitle}
        onCreateCategory={() => void createCategory()}
        onDeleteBlock={block => {
          onDeleteBlock(block.id);
          setEditorOpen(false);
        }}
        onDeleteCategory={() => void deleteCategory()}
        onDeleteSuggestion={suggestion => {
          onDeleteScheduleSuggestion?.(suggestion);
          setEditorOpen(false);
          setEditingSuggestion(null);
        }}
        onOpenSourceMemo={memoId => {
          window.dispatchEvent(
            new CustomEvent('subnota:preview-memo', {
              detail: { memoId },
            }),
          );
          setEditorOpen(false);
        }}
        onSelectCategory={selectCategory}
        onSubmit={submit}
        onToggleCategoryMenu={() => {
          setCategoryMenuOpen(open => !open);
          setCategoryMenuMode('list');
          setDeleteCategoryId(null);
        }}
        selectedCategoryId={selectedCategoryId}
        selectedColor={selectedColor}
        selectedDate={selectedDate}
        shouldReduceMotion={shouldReduceMotion}
        sourceMemoId={sourceMemoId}
        time={time}
        title={title}
        translate={t}
      />
    </div>
  );
};

export default CalendarWorkspace;
