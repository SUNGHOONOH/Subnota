import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Inbox,
  List,
  Plus,
  Trash2,
  ChartBar,
} from '@/components/icons';
import TooltipIconButton from '../../components/TooltipIconButton';
import { ColorPicker, Popover } from '@mantine/core';

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
  DEFAULT_CALENDAR_EVENT_DURATION_MS,
  SCHEDULE_INBOX_DRAG_TYPE,
  calendarSpanDisplayRange,
  dateAtDropOffset,
  movedStartMinutes,
  withMinutesOfDay,
  findPreviousAvailableTime,
  getBlockStart,
  resizeRangeAtEdge,
} from './calendarUtils';
import DateScheduleField from '../memo/components/DateScheduleField';
import DayTodoPanel from './components/DayTodoPanel';
import { hasScheduledTime } from '../schedule/scheduleInboxUtils';
import {
  ANCHORED_MODAL_MIN_HEIGHT,
  getAnchoredPlacement,
} from '../../lib/anchoredPlacement';
import {
  CALENDAR_COLOR_PRESETS,
  DEFAULT_CALENDAR_COLOR,
} from './calendarCategories';
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

type ViewType = 'week' | 'month';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 40;
const DEFAULT_COLOR = DEFAULT_CALENDAR_COLOR;
const HOUR_MS = DEFAULT_CALENDAR_EVENT_DURATION_MS;
// 일정 길이는 데이터 그대로 저장한다. 30분은 "블록이 너무 납작해 글자가 안
// 들어간다"는 렌더 문제였을 뿐이라, 최소 높이(px)로만 남긴다.
// 13px = 제목 한 줄(line-height 13)이 들어가는 최소값. 18px이던 시절에는
// 15분(실제 8px)과 30분(18px)이 화면에서 똑같아 보였다.
const EVENT_MIN_HEIGHT_PX = 13;
// 공간은 제목이 먼저 가져간다. 시간은 남을 때만 붙는 정보다 — 제목을 잘라
// 가며 보여 줄 값이 아니다. 45·60분 카드는 제목이 한 줄일 때만 시간을
// 붙이고, 제목이 두 줄이면 제목을 우선한다.
//
//   ~24px   제목 한 줄            15·30분
//   ~43px   제목 두 줄 / 한 줄 + 시간 45·60분
//   44px~   제목 두 줄 + 시간     90분 이상
//
// 두 줄은 2 + 13 × 2 = 28px를 쓰므로 45분(28px)에 꼭 맞고,
// 제목 한 줄과 시간은 2 + 13 + 11 = 26px라 45분부터 가능하다.
const EVENT_COMPACT_HEIGHT_PX = 24;
const EVENT_SINGLE_LINE_TIME_HEIGHT_PX = 28;
const EVENT_TIME_HEIGHT_PX = 44;
// 리사이즈로 만들 수 있는 최소 길이. 0/역방향만 막는다.
const MIN_EVENT_MINUTES = 5;
const MONTH_CELL_CHROME_HEIGHT = 34;
const MONTH_ITEM_ROW_HEIGHT = 19;
const MONTH_MAX_VISIBLE_ITEM_LIMIT = 5;
const RESIZE_STEP_MINUTES = DRAG_SNAP_MINUTES;

// Soft Apple-like tints: light fill + same-hue text + accent bar.
const TONE_STYLE: Record<string, { accent: string; bg: string; text: string }> =
  {
    '#20B76A': { accent: '#20b76a', bg: '#d9f8e6', text: '#127343' },
    '#2E8FE5': { accent: '#2e8fe5', bg: '#dceeff', text: '#1763ab' },
    '#7650E6': { accent: '#7650e6', bg: '#e7dfff', text: '#5131b4' },
    '#E24782': { accent: '#e24782', bg: '#fce1ec', text: '#ad2758' },
    '#FF5357': { accent: '#ff5357', bg: '#ffe0e0', text: '#b62e34' },
    '#FFB31A': { accent: '#ffb31a', bg: '#fff0c9', text: '#a86c00' },
    '#2F3437': { accent: '#3b4045', bg: '#eceef0', text: '#2f3437' },
    '#A75C4A': { accent: '#c2593f', bg: '#f7e8e3', text: '#8a4636' },
    '#66705A': { accent: '#6f7a61', bg: '#ecefe6', text: '#4b5741' },
    '#5D6A73': { accent: '#5d6a73', bg: '#e8ecee', text: '#46535b' },
    '#7A6688': { accent: '#7a6688', bg: '#eee9f0', text: '#594565' },
    '#A47A36': { accent: '#a47a36', bg: '#f4eddf', text: '#76541d' },
  };

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, value));

const mixHex = (source: string, target: string, amount: number) => {
  const channel = (index: number) =>
    clampColorChannel(
      Math.round(
        Number.parseInt(source.slice(index, index + 2), 16) * (1 - amount) +
          Number.parseInt(target.slice(index, index + 2), 16) * amount,
      ),
    )
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

const hexToRgba = (color: string) => {
  const normalized = color.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 1)`;
};

const getTone = (color: string | null) => {
  const normalized = (color ?? '').toUpperCase();
  const preset = TONE_STYLE[normalized];
  if (preset) return preset;
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return TONE_STYLE[DEFAULT_COLOR];
  return {
    accent: normalized,
    bg: mixHex(normalized, '#FFFFFF', 0.8),
    text: mixHex(normalized, '#1D1D1F', 0.48),
  };
};

const getRange = (block: CalendarBlockRow) => {
  const start = getBlockStart(block);
  const end = block.end_date
    ? new Date(block.end_date)
    : new Date(start.getTime() + HOUR_MS);
  return { end, start };
};

const getScheduleSuggestionTitle = (
  item: ScheduleInboxRow,
  language: 'en' | 'ko',
) =>
  item.title.trim() ||
  item.source_text.trim() ||
  localize(language, '일정 제안', 'Schedule suggestion');

const toLocalInputDate = (date: Date) => format(date, 'yyyy-MM-dd');
// Shift를 누르고 있으면 스냅을 끄고 1분 단위로 조정한다 (Fantastical 관례).
const snapResizeMinutes = (pixelDelta: number, step = RESIZE_STEP_MINUTES) =>
  Math.round(((pixelDelta / HOUR_HEIGHT) * 60) / step) * step;

const timeGridOffset = (date: Date) =>
  (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;

const formatPreviewDuration = (durationMs: number, language: 'en' | 'ko') => {
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return minutes % 60 === 0
    ? localize(language, `${minutes / 60}시간`, `${minutes / 60} hr`)
    : localize(language, `${minutes}분`, `${minutes} min`);
};

interface CalendarDropPreview {
  dateKey: string;
  durationMs: number;
  isAvailable: boolean;
  start: Date;
  title: string;
}

interface CalendarResizePreview {
  blockId: string;
  end: Date;
  start: Date;
}

// New drops do not create overlaps. This fallback keeps an old conflicting
// record from expanding into many unreadable rows until the user adjusts it.
interface TimedCalendarItem {
  block: CalendarBlockRow | null;
  daySpan: number;
  end: Date;
  suggestion: ScheduleInboxRow | null;
  start: Date;
}

interface LaidOutEvent extends TimedCalendarItem {
  overflowCount: number;
  stackCount: number;
  stackIndex: number;
  stackRowHeight: number;
  stackStart: Date;
}

const layoutTimedItems = (items: TimedCalendarItem[]): LaidOutEvent[] => {
  const sorted = items
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const groups: TimedCalendarItem[][] = [];
  let currentGroup: TimedCalendarItem[] = [];
  let currentGroupEnd = 0;

  sorted.forEach((item) => {
    const itemStart = item.start.getTime();
    if (currentGroup.length === 0 || itemStart >= currentGroupEnd) {
      currentGroup = [item];
      groups.push(currentGroup);
      currentGroupEnd = item.end.getTime();
      return;
    }

    currentGroup.push(item);
    currentGroupEnd = Math.max(currentGroupEnd, item.end.getTime());
  });

  return groups.flatMap((group) => {
    const isStacked = group.length > 1;
    const stackStart = group[0].start;
    const stackEnd = Math.max(...group.map((item) => item.end.getTime()));
    const stackRowHeight = isStacked
      ? Math.max(
          HOUR_HEIGHT / 2,
          ((stackEnd - stackStart.getTime()) / 3_600_000) * HOUR_HEIGHT,
        )
      : 0;
    const representative = group
      .slice()
      .sort(
        (a, b) =>
          a.start.getTime() - b.start.getTime() ||
          Number(Boolean(b.block)) - Number(Boolean(a.block)),
      )[0];

    return [
      {
        ...representative,
        overflowCount: Math.max(0, group.length - 1),
        stackCount: group.length,
        stackIndex: 0,
        stackRowHeight,
        stackStart,
      },
    ];
  });
};

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
  const weekStartsOn = useMemo(() => {
    const locale = new Intl.Locale(dateLocale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
    };
    const firstDay = locale.getWeekInfo?.().firstDay;
    return (firstDay === undefined ? (language === 'en' ? 1 : 0) : firstDay % 7) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6;
  }, [dateLocale, language]);
  const dayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 7 + ((weekStartsOn + index) % 7))),
    );
  }, [dateLocale, weekStartsOn]);
  const formatCalendarTime = useCallback(
    (date: Date) =>
      new Intl.DateTimeFormat(dateLocale, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date),
    [dateLocale],
  );
  const formatCalendarDate = useCallback(
    (date: Date) =>
      new Intl.DateTimeFormat(dateLocale, {
        day: 'numeric',
        month: 'long',
      }).format(date),
    [dateLocale],
  );
  const [view, setView] = useState<ViewType>('week');
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
    if (view === 'month') {
      return new Intl.DateTimeFormat(dateLocale, {
        month: 'long',
        year: 'numeric',
      }).format(anchor);
    }
    const start = startOfWeek(anchor, { weekStartsOn });
    const end = endOfWeek(anchor, { weekStartsOn });
    const formatter = new Intl.DateTimeFormat(dateLocale, {
      day: 'numeric',
      month: 'short',
    });
    return `${formatter.format(start)} – ${formatter.format(end)}`;
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

  const dayEvents = (date: Date) =>
    blocks
      .filter((block) => isSameDay(getBlockStart(block), date))
      .sort((a, b) => getBlockStart(a).getTime() - getBlockStart(b).getTime());

  const rangeForBlock = (block: CalendarBlockRow) =>
    calendarResizePreview?.blockId === block.id
      ? {
          end: calendarResizePreview.end,
          start: calendarResizePreview.start,
        }
      : getRange(block);

  const timedEventsForDay = (date: Date): TimedCalendarItem[] =>
    blocks
      .filter((block) => !block.all_day)
      .flatMap((block) => {
        const range = rangeForBlock(block);
        if (!isSameDay(range.start, date)) return [];

        return [
          {
            block,
            suggestion: null,
            ...calendarSpanDisplayRange(range.start, range.end),
          },
        ];
      });

  const dayScheduleSuggestions = (date: Date) =>
    scheduleSuggestions
      .filter((item) => {
        const scheduledAt = toValidDate(item.scheduled_at);
        return scheduledAt ? isSameDay(scheduledAt, date) : false;
      })
      .sort((a, b) => {
        const aDate = toValidDate(a.scheduled_at);
        const bDate = toValidDate(b.scheduled_at);
        return (aDate?.getTime() ?? 0) - (bDate?.getTime() ?? 0);
      });

  const findAvailableDropStart = (
    requestedStart: Date,
    durationMs: number,
    excludeBlockId?: string,
  ) =>
    findPreviousAvailableTime(
      requestedStart,
      durationMs,
      blocks
        .filter((block) => !block.all_day && block.id !== excludeBlockId)
        .map((block) => getRange(block)),
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

  const renderMonth = () => (
    <div className="cal-month">
      <div className="cal-weekday-row">
        {dayLabels.map((label, index) => (
          <span
            className={
              (weekStartsOn + index) % 7 === 0
                ? 'sunday'
                : (weekStartsOn + index) % 7 === 6
                  ? 'saturday'
                  : ''
            }
            key={label}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="cal-month-grid" ref={monthGridRef}>
        {monthDays.map((date) => {
          const events = dayEvents(date);
          const suggestions = dayScheduleSuggestions(date);
          const monthItems = [
            ...events.map((block) => ({
              allDay: Boolean(block.all_day),
              block,
              kind: 'block' as const,
              sortTime: getBlockStart(block).getTime(),
            })),
            ...suggestions.flatMap((suggestion) => {
              const scheduledAt = toValidDate(suggestion.scheduled_at);
              return scheduledAt
                ? [
                    {
                      allDay: !hasScheduledTime(suggestion),
                      kind: 'suggestion' as const,
                      scheduledAt,
                      sortTime: scheduledAt.getTime(),
                      suggestion,
                    },
                  ]
                : [];
            }),
          ].sort(
            (a, b) =>
              Number(b.allDay) - Number(a.allDay) || a.sortTime - b.sortTime,
          );
          const visibleItems =
            monthItems.length > monthVisibleItemLimit
              ? monthItems.slice(0, Math.max(1, monthVisibleItemLimit - 1))
              : monthItems;
          const hiddenCount = monthItems.length - visibleItems.length;
          const inMonth = isSameMonth(date, anchor);
          const isSelected = isSameDay(date, selectedDay);
          return (
            <div
              aria-label={t(
                `${formatCalendarDate(date)}, ${monthItems.length}개 일정`,
                `${formatCalendarDate(date)}, ${monthItems.length} events`,
              )}
              className={`cal-month-cell${inMonth ? '' : ' muted'}${
                isSelected ? ' selected' : ''
              }`}
              key={date.toISOString()}
              onClick={() => selectDay(date)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectDay(date);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="cal-month-meta">
                {hiddenCount > 0 && (
                  <button
                    aria-label={t(
                      `${formatCalendarDate(date)}의 나머지 일정 ${hiddenCount}개`,
                      `${hiddenCount} more events on ${formatCalendarDate(date)}`,
                    )}
                    className="cal-month-more"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectDay(date);
                    }}
                    type="button"
                  >
                    {t(`+${hiddenCount}개`, `+${hiddenCount}`)}
                  </button>
                )}
                <span
                  className={`cal-daynum${isToday(date) ? ' today' : ''}${
                    date.getDay() === 0 ? ' sunday' : ''
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="cal-month-items">
                {visibleItems.map((item) => {
                  if (item.kind === 'block') {
                    const { block } = item;
                    const start = getBlockStart(block);
                    const tone = getTone(block.color);
                    return (
                      <button
                        aria-label={`${block.title}, ${block.all_day ? t('종일', 'All day') : formatCalendarTime(start)}`}
                        className={`cal-month-item${block.is_completed ? ' completed' : ''}`}
                        key={block.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditor(start, block, event.currentTarget);
                        }}
                        style={{ backgroundColor: tone.bg, color: tone.text }}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="cal-month-item-dot"
                          style={{ backgroundColor: tone.accent }}
                        />
                        <span
                          className="cal-month-item-title"
                          title={block.title}
                        >
                          {block.title}
                        </span>
                        {!block.all_day && (
                          <span className="cal-month-item-time">
                            {format(start, 'HH:mm')}
                          </span>
                        )}
                      </button>
                    );
                  }

                  const { scheduledAt, suggestion } = item;
                  const suggestionTitle =
                    getScheduleSuggestionTitle(suggestion, language);
                  return (
                    <button
                      aria-label={t(
                        `${suggestionTitle} 일정 제안, ${item.allDay ? '시간 미정' : formatCalendarTime(scheduledAt)}`,
                        `${suggestionTitle} schedule suggestion, ${item.allDay ? 'time not set' : formatCalendarTime(scheduledAt)}`,
                      )}
                      className="cal-month-item cal-month-suggestion"
                      key={`suggestion:${suggestion.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openSuggestionEditor(suggestion, event.currentTarget);
                      }}
                      type="button"
                    >
                      <span
                        className="cal-month-item-title"
                        title={suggestionTitle}
                      >
                        {suggestionTitle}
                      </span>
                      {!item.allDay && (
                        <span className="cal-month-item-time">
                          {format(scheduledAt, 'HH:mm')}
                        </span>
                      )}
                    </button>
                  );
                })}
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
        <div className="cal-header">
          <h2 className="cal-title">{title_}</h2>

          <div className="cal-toolbar">
            <div aria-label={t('캘린더 보기', 'Calendar view')} className="cal-views" role="group">
              {(['week', 'month'] as ViewType[]).map((key) => (
                <button
                  aria-pressed={view === key}
                  className={view === key ? 'active' : ''}
                  key={key}
                  onClick={() => {
                    setView(key);
                    if (key !== 'month') setMonthTodoOverlayOpen(false);
                  }}
                  type="button"
                >
                  {key === 'week' ? t('주', 'Week') : t('월', 'Month')}
                </button>
              ))}
            </div>

            <div aria-label={t('캘린더 이동', 'Calendar navigation')} className="cal-nav" role="group">
              <button
                aria-label={t('이전', 'Previous')}
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
                {t('오늘', 'Today')}
              </button>
              <button
                aria-label={t('다음', 'Next')}
                className="cal-nav-icon"
                onClick={() => move(1)}
                type="button"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          {/* 아이콘만 있는 버튼이라 이름이 필요하다. 네이티브 title은 1초쯤
              지나서야 뜨고 OS 모양이라, 앱 공용 툴팁으로 통일한다. */}
          {onToggleScheduleInbox && (
            <TooltipIconButton
              aria-label={t('일정 저장함', 'Schedule inbox')}
              aria-pressed={isScheduleInboxOpen}
              className={`cal-inbox-button${isScheduleInboxOpen ? ' active' : ''}`}
              onClick={onToggleScheduleInbox}
              tooltip={
                isScheduleInboxOpen
                  ? t('일정 저장함 닫기', 'Close schedule inbox')
                  : t('일정 저장함', 'Schedule inbox')
              }
            >
              <Inbox size={18} />
            </TooltipIconButton>
          )}
          {onOpenReport && (
            <TooltipIconButton
              aria-label={t('월간 기록', 'Monthly report')}
              className={`cal-report-button${hasNewReport ? ' has-new' : ''}`}
              onClick={onOpenReport}
              tooltip={
                hasNewReport
                  ? t('월간 기록 · 새 기록 있음', 'Monthly report · new report available')
                  : t('월간 기록', 'Monthly report')
              }
            >
              <ChartBar size={18} />
              {hasNewReport && <span aria-hidden className="cal-report-dot" />}
            </TooltipIconButton>
          )}
        </div>

        {view === 'month' ? renderMonth() : renderTimeGrid()}
      </div>

      {view === 'month' && (
        <aside className="cal-side">
          <DayTodoPanel
            blocks={dayEvents(selectedDay)}
            date={selectedDay}
            isDetailOpen={isMonthTodoOverlayOpen}
            onAdd={() => openEditor(selectedDay)}
            onEdit={(block) => openEditor(getBlockStart(block), block)}
            onToggleDetail={() => setMonthTodoOverlayOpen((isOpen) => !isOpen)}
            onToggle={onToggleCompleted}
          />
        </aside>
      )}

      <AnimatePresence initial={false}>
        {view === 'month' && isMonthTodoOverlayOpen && (
          <motion.aside
            animate={{ opacity: 1, y: 0 }}
            aria-label={t(
              `${formatCalendarDate(selectedDay)} 할 일 상세`,
              `${formatCalendarDate(selectedDay)} to-do details`,
            )}
            className="cal-month-todo-overlay"
            exit={
              shouldReduceMotion
                ? undefined
                : { opacity: 0, transition: { duration: 0.15 }, y: 8 }
            }
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            key="month-todo-overlay"
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { bounce: 0, duration: 0.3, type: 'spring' }
            }
          >
            <DayTodoPanel
              blocks={dayEvents(selectedDay)}
              date={selectedDay}
              isDetailOpen
              onAdd={() => openEditor(selectedDay)}
              onEdit={(block) => openEditor(getBlockStart(block), block)}
              onToggleDetail={() => setMonthTodoOverlayOpen(false)}
              onToggle={onToggleCompleted}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 바깥 클릭으로 닫지 않는다. 저장을 명시적으로 받는 창이라 닫는 것도
          명시적이어야 한다 — 실수로 스친 클릭에 쓰던 내용이 사라지면 안 된다.
          나가는 길은 취소 버튼과 Esc 둘뿐이고, 둘 다 일부러 누르는 것이다. */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className={`modal-backdrop${anchoredPlacement ? ' anchored' : ''}`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="presentation"
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.14, ease: 'easeOut' }
            }
          >
            {/* 앵커가 있으면 누른 일정 옆에서, 없으면 가운데에서 자란다.
                자라는 방향(transform-origin)이 어디를 눌렀는지 말해 준다 —
                페이드만으로는 출처를 알 수 없다. */}
            <motion.form
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              className={
                anchoredPlacement
                  ? `cal-modal anchored ${anchoredPlacement.side}`
                  : 'cal-modal'
              }
              exit={
                anchoredPlacement
                  ? { opacity: 0, scale: 0.96 }
                  : { opacity: 0, scale: 0.99, y: -6 }
              }
              initial={
                anchoredPlacement
                  ? {
                      opacity: 0,
                      scale: 0.94,
                      x: anchoredPlacement.side === 'right' ? -6 : 6,
                    }
                  : { opacity: 0, scale: 0.99, y: -8 }
              }
              onSubmit={submit}
              ref={anchoredModalRef}
              style={
                anchoredPlacement
                  ? {
                      left: anchoredPlacement.left,
                      position: 'fixed',
                      top: anchoredPlacement.top,
                      width: anchoredPlacement.width,
                      ['--cal-modal-tail-top' as string]:
                        `${anchoredPlacement.tailTop}px`,
                    }
                  : undefined
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: 'easeOut' }
              }
            >
            {/* 제목 입력이 헤더를 대신한다. "새 일정"이라는 제목줄과 "제목"
                라벨과 입력칸이 따로 있으면 같은 말을 세 번 하면서 세로를
                세 줄 먹는다. 무엇을 하려고 연 창인지는 이미 알고 열었다. */}
            <header className="cal-modal-head">
              <input
                aria-label={t('일정 제목', 'Event title')}
                autoFocus
                className="cal-modal-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  editingSuggestion
                    ? t('일정 제안', 'Schedule suggestion')
                    : editingBlock
                      ? t('일정 수정', 'Edit event')
                      : t('새 일정', 'New event')
                }
                value={title}
              />
              <div className="cal-modal-head-actions">
                {!editingSuggestion && (
                  <div className="cal-category-picker" ref={categoryPickerRef}>
                    <button
                      aria-expanded={isCategoryMenuOpen}
                      aria-haspopup="menu"
                      aria-label={t('일정 색상 및 카테고리', 'Event color and category')}
                      className="cal-category-trigger"
                      onClick={() => {
                        setCategoryMenuOpen((open) => !open);
                        setCategoryMenuMode('list');
                        setDeleteCategoryId(null);
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="cal-category-color-dot"
                        style={{
                          backgroundColor: selectedCategoryId
                            ? selectedColor
                            : DEFAULT_COLOR,
                        }}
                      />
                      <ChevronDown size={14} />
                    </button>

                    {isCategoryMenuOpen && (
                      <div
                        aria-label={t('카테고리 및 색상', 'Categories and colors')}
                        className="cal-category-menu"
                        role="menu"
                      >
                        {categoryMenuMode === 'list' ? (
                          <>
                            <div className="cal-category-menu-head">
                              <strong>{t('카테고리', 'Categories')}</strong>
                              <button
                                aria-label={t('새 카테고리', 'New category')}
                                className="cal-category-add-icon"
                                onClick={() => {
                                  setCategoryMenuMode('create');
                                  setCustomColorPickerOpen(false);
                                  setDeleteCategoryId(null);
                                }}
                                type="button"
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                            <button
                              className={`cal-category-option${selectedCategoryId === null ? ' selected' : ''}`}
                              onClick={() => selectCategory(null)}
                              role="menuitemradio"
                              aria-checked={selectedCategoryId === null}
                              type="button"
                            >
                              <span
                                aria-hidden="true"
                                className="cal-category-color-dot"
                                style={{ backgroundColor: DEFAULT_COLOR }}
                              />
                              <span>{t('기본', 'Default')}</span>
                              {selectedCategoryId === null && (
                                <b aria-hidden="true">✓</b>
                              )}
                            </button>
                            {categories.map((category) => (
                              <div
                                className="cal-category-row"
                                key={category.id}
                              >
                                <button
                                  className={`cal-category-option${selectedCategoryId === category.id ? ' selected' : ''}`}
                                  onClick={() => selectCategory(category)}
                                  role="menuitemradio"
                                  aria-checked={
                                    selectedCategoryId === category.id
                                  }
                                  type="button"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="cal-category-color-dot"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  <span>{category.name}</span>
                                  {selectedCategoryId === category.id && (
                                    <b aria-hidden="true">✓</b>
                                  )}
                                </button>
                                <button
                                  aria-label={t(
                                    `${category.name} 카테고리 삭제`,
                                    `Delete ${category.name} category`,
                                  )}
                                  className="cal-category-delete"
                                  onClick={() =>
                                    setDeleteCategoryId(category.id)
                                  }
                                  type="button"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            {deleteCategoryId && (
                              <div
                                className="cal-category-delete-confirm"
                                role="alert"
                              >
                                <p>
                                  {t(
                                    '삭제하면 해당 일정은 기본 초록색으로 바뀝니다.',
                                    'Deleting it changes its events to the default green.',
                                  )}
                                </p>
                                <div>
                                  <button
                                    className="cal-category-confirm-cancel"
                                    onClick={() => setDeleteCategoryId(null)}
                                    type="button"
                                  >
                                    {t('취소', 'Cancel')}
                                  </button>
                                  <button
                                    className="cal-category-confirm-delete"
                                    onClick={() => void deleteCategory()}
                                    type="button"
                                  >
                                    {t('삭제', 'Delete')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="cal-category-create">
                            <div className="cal-category-menu-head">
                              <button
                                className="cal-category-back"
                                onClick={() => setCategoryMenuMode('list')}
                                type="button"
                              >
                                ←
                              </button>
                              <strong>{t('새 카테고리', 'New category')}</strong>
                            </div>
                            <input
                              aria-label={t('카테고리 이름', 'Category name')}
                              autoFocus
                              className="cal-category-name-input"
                              maxLength={40}
                              onChange={(event) =>
                                setNewCategoryName(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                void createCategory();
                              }}
                              placeholder={t('카테고리 이름', 'Category name')}
                              value={newCategoryName}
                            />
                            <div
                              className="cal-category-color-grid"
                              aria-label={t('카테고리 색상', 'Category color')}
                            >
                              {CALENDAR_COLOR_PRESETS.map((preset) => (
                                <button
                                  aria-label={t(
                                    `${preset.label} 색상`,
                                    `${preset.labelEn} color`,
                                  )}
                                  className={`cal-category-swatch${newCategoryColor === preset.color ? ' selected' : ''}`}
                                  key={preset.color}
                                  onClick={() => {
                                    setNewCategoryColor(preset.color);
                                    setCustomColorPickerOpen(false);
                                  }}
                                  style={{ backgroundColor: preset.color }}
                                  type="button"
                                />
                              ))}
                              <Popover
                                onChange={setCustomColorPickerOpen}
                                opened={isCustomColorPickerOpen}
                                position="bottom-end"
                                shadow="md"
                                withinPortal={false}
                              >
                                <Popover.Target>
                                  <button
                                    aria-expanded={isCustomColorPickerOpen}
                                    aria-haspopup="dialog"
                                    aria-label={t('사용자 지정 색상', 'Custom color')}
                                    className="cal-category-custom-swatch"
                                    onClick={() =>
                                      setCustomColorPickerOpen((open) => !open)
                                    }
                                    type="button"
                                  />
                                </Popover.Target>
                                <Popover.Dropdown className="cal-category-color-popover">
                                  <ColorPicker
                                    format="hex"
                                    hueLabel={t('색조', 'Hue')}
                                    onChange={(color) =>
                                      setNewCategoryColor(color.toUpperCase())
                                    }
                                    saturationLabel={t('채도와 명도', 'Saturation and lightness')}
                                    size="sm"
                                    value={newCategoryColor}
                                  />
                                  <div className="cal-category-color-controls">
                                    <span
                                      aria-label={t('선택한 색상 미리보기', 'Selected color preview')}
                                      className="cal-category-color-preview"
                                      role="img"
                                      style={{
                                        backgroundColor: newCategoryColor,
                                      }}
                                    />
                                    <input
                                      aria-label={t('선택한 RGBA 색상', 'Selected RGBA color')}
                                      className="cal-category-color-rgba"
                                      readOnly
                                      value={hexToRgba(newCategoryColor)}
                                    />
                                    <button
                                      className="cal-category-color-confirm"
                                      onClick={() =>
                                        setCustomColorPickerOpen(false)
                                      }
                                      type="button"
                                    >
                                      {t('확인', 'Done')}
                                    </button>
                                  </div>
                                </Popover.Dropdown>
                              </Popover>
                            </div>
                            <button
                              className="cal-category-create-submit"
                              disabled={!newCategoryName.trim()}
                              onClick={() => void createCategory()}
                              type="button"
                            >
                              {t('추가', 'Add')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </header>

            {/* 라벨 대신 아이콘. 배경도 나누지 않고 hairline으로만 끊는다 —
                칸마다 배경+테두리+곡률을 주면 상자가 여러 개로 읽힌다. */}
            <div className="cal-modal-rows">
              <div className="cal-modal-row">
                <DateScheduleField
                  allDay={!time}
                  date={new Date(`${selectedDate}T${time || '00:00'}:00`)}
                  label={null}
                  onChange={(date, allDay) => {
                    setSelectedDate(toLocalInputDate(date));
                    setTime(allDay ? '' : format(date, 'HH:mm'));
                  }}
                />
              </div>
              <div className="cal-modal-row">
                <List aria-hidden="true" className="cal-modal-row-icon" size={15} />
                <textarea
                  aria-label={t('메모', 'Note')}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t('메모 추가', 'Add a note')}
                  value={note}
                />
              </div>
            </div>
            {sourceMemoId && (
              <button
                className="cal-btn ghost cal-source-note-btn"
                onClick={() => {
                  // 캘린더를 보면서 출처를 확인하는 흐름이라 미리보기로 연다.
                  window.dispatchEvent(
                    new CustomEvent('subnota:preview-memo', {
                      detail: { memoId: sourceMemoId },
                    }),
                  );
                  setEditorOpen(false);
                }}
                type="button"
              >
                {t('원본 노트 열기', 'Open source memo')}
              </button>
            )}
            {/* 삭제는 헤더가 아니라 여기, 저장 반대편에 둔다. 되돌릴 수 없는
                동작이 색 고르는 버튼 옆에 있을 이유가 없다. */}
            <footer className="cal-modal-foot">
              {editingSuggestion ? (
                <button
                  className="cal-modal-delete-text"
                  onClick={() => {
                    onDeleteScheduleSuggestion?.(editingSuggestion);
                    setEditorOpen(false);
                    setEditingSuggestion(null);
                  }}
                  type="button"
                >
                  {t('삭제', 'Delete')}
                </button>
              ) : editingBlock ? (
                <button
                  className="cal-modal-delete-text"
                  onClick={() => {
                    onDeleteBlock(editingBlock.id);
                    setEditorOpen(false);
                  }}
                  type="button"
                >
                  {t('삭제', 'Delete')}
                </button>
              ) : null}
              <p className="cal-modal-hint">
                {editingSuggestion
                  ? t(
                      '시간을 비우면 종일 · 원본 메모는 그대로',
                      'Clear the time for all day · source memo stays unchanged',
                    )
                  : t('시간을 비우면 종일', 'Clear the time for all day')}
              </p>
              <div className="cal-modal-actions">
                <button
                  className="cal-btn ghost"
                  onClick={() => {
                    setEditorOpen(false);
                    setEditingSuggestion(null);
                  }}
                  type="button"
                >
                  {t('취소', 'Cancel')}
                </button>
                <button className="cal-btn primary" type="submit">
                  {editingSuggestion ? t('등록', 'Add') : t('저장', 'Save')}
                </button>
              </div>
            </footer>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarWorkspace;
