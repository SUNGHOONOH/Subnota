import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MoreHorizontal,
  Network,
  Plus,
  Trash2,
} from 'lucide-react-native';

import {
  DateMatch,
  formatRelativeDisplayDate,
  parseDates,
} from '../../lib/dateParser';
import { hashText } from '../../lib/contentHash';
import {
  AMBIENT_COOLDOWN_MS,
  AMBIENT_IDLE_DELAY_MS,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
} from '../../lib/constants';
import { getCursorChunkWindow, MemoChunk } from '../../lib/memoChunker';
import {
  NetworkSearchResult,
  searchCursorNetwork,
} from '../../services/backend/networkService';
import { requireOnlineLogin } from '../../services/supabase/authGate';
import { Memo, MemoDateAnchor, useMemoStore } from '../../store/useMemoStore';
import { SidebarViewMode } from './components/MemoSidebar';
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import DateQuickActions from './components/DateQuickActions';
import AmbientNetworkCard from './components/AmbientNetworkCard';
import AmbientNetworkDetailPanel from './components/AmbientNetworkDetailPanel';
import MemoEditor from './components/MemoEditor';
import MemoNetworkPanel from './components/MemoNetworkPanel';
import MemoSidebar from './components/MemoSidebar';
import MiniCalendarPopover from './components/MiniCalendarPopover';

const EDITOR_LINE_HEIGHT = 28;
const EDITOR_PADDING_TOP = 20;
const TOOLTIP_HEIGHT = 34;
const TOOLTIP_GAP = 10;
const SELECTION_TOOLBAR_HEIGHT = 32;
const DATE_ACTIONS_ACCESSORY_ID = 'memo-date-actions-accessory';
const TOOLTIP_APPROX_CHAR_WIDTH = 10;

const getTextIndexLine = (text: string, textIndex: number) => {
  return text.slice(0, textIndex).split('\n').length - 1;
};

const getTooltipPosition = (
  text: string,
  textIndex: number,
  editorHeight: number,
  editorWidth: number,
) => {
  const activeLine = getTextIndexLine(text, textIndex);
  const activeColumn = text.slice(0, textIndex).split('\n').at(-1)?.length ?? 0;
  const activeLineTop = EDITOR_PADDING_TOP + activeLine * EDITOR_LINE_HEIGHT;
  const topCandidate = activeLineTop - TOOLTIP_HEIGHT - TOOLTIP_GAP;
  const bottomCandidate = activeLineTop + EDITOR_LINE_HEIGHT + TOOLTIP_GAP;
  const top =
    topCandidate >= EDITOR_PADDING_TOP
      ? topCandidate
      : Math.min(
          Math.max(bottomCandidate, EDITOR_PADDING_TOP),
          Math.max(EDITOR_PADDING_TOP, editorHeight - TOOLTIP_HEIGHT - 8),
        );
  const left = Math.min(
    Math.max(4, activeColumn * TOOLTIP_APPROX_CHAR_WIDTH),
    Math.max(4, editorWidth - 280),
  );

  return { left, top };
};

const findFocusedDateMatch = (
  matches: DateMatch[],
  selectionStart: number,
  selectionEnd: number,
) => {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  return (
    matches.find(match => {
      const matchEnd = match.index + match.length;
      return selectionStart >= match.index && selectionStart <= matchEnd;
    }) ?? null
  );
};

const formatDateMatchTooltip = (match: DateMatch, baseTimestamp: number) => {
  const hasTime =
    match.date.getHours() !== 0 ||
    match.date.getMinutes() !== 0 ||
    match.date.getSeconds() !== 0;
  const dateText = formatRelativeDisplayDate(match.date, baseTimestamp);

  return hasTime ? `${dateText} ${format(match.date, 'HH:mm')}` : dateText;
};

const splitHighlightedText = (text: string, matches: DateMatch[]) => {
  const pieces: Array<{ key: string; text: string; highlighted: boolean }> = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.index > cursor) {
      pieces.push({
        key: `plain-${index}`,
        text: text.slice(cursor, match.index),
        highlighted: false,
      });
    }

    pieces.push({
      key: `date-${index}`,
      text: text.slice(match.index, match.index + match.length),
      highlighted: true,
    });
    cursor = match.index + match.length;
  });

  if (cursor < text.length) {
    pieces.push({
      key: 'plain-tail',
      text: text.slice(cursor),
      highlighted: false,
    });
  }

  return pieces;
};

const reconcileDateTokenAnchors = (
  text: string,
  previousAnchors: MemoDateAnchor[],
  baseTimestamp = Date.now(),
) => {
  const detectedMatches = parseDates(text, baseTimestamp);
  const availableAnchors = previousAnchors.map(anchor => ({
    ...anchor,
    used: false,
  }));

  return detectedMatches.map(match => {
    const exactAnchor = availableAnchors.find(
      anchor =>
        !anchor.used &&
        anchor.text === match.text &&
        anchor.index === match.index &&
        anchor.length === match.length,
    );
    const shiftedAnchor =
      exactAnchor ??
      availableAnchors
        .filter(anchor => !anchor.used && anchor.text === match.text)
        .sort(
          (a, b) =>
            Math.abs(a.index - match.index) - Math.abs(b.index - match.index),
        )[0];
    const anchor = shiftedAnchor ?? {
      baseTimestamp,
      index: match.index,
      length: match.length,
      text: match.text,
      used: false,
    };

    anchor.used = true;

    return {
      baseTimestamp: anchor.baseTimestamp,
      index: match.index,
      length: match.length,
      text: match.text,
    };
  });
};

const buildAnchoredDateMatches = (text: string, anchors: MemoDateAnchor[]) => {
  return anchors
    .map(anchor => {
      const parsed = parseDates(anchor.text, anchor.baseTimestamp)[0];

      if (!parsed) {
        return null;
      }

      return {
        ...parsed,
        index: anchor.index,
        length: anchor.length,
        text: text.slice(anchor.index, anchor.index + anchor.length),
      };
    })
    .filter((match): match is DateMatch => match !== null);
};

const MemoScreen = () => {
  const { width: screenWidth } = useWindowDimensions();
  const isPhone = screenWidth < 768;
  const memos = useMemoStore(state => state.memos);
  const addMemo = useMemoStore(state => state.addMemo);
  const addScheduleFromSelection = useMemoStore(
    state => state.addScheduleFromSelection,
  );
  const deleteMemo = useMemoStore(state => state.deleteMemo);
  const toggleMemoPinned = useMemoStore(state => state.toggleMemoPinned);
  const updateMemo = useMemoStore(state => state.updateMemo);
  const activeCategoryFilter = useMemoStore(
    state => state.activeCategoryFilter,
  );
  const setActiveCategoryFilter = useMemoStore(
    state => state.setActiveCategoryFilter,
  );
  const clearActiveCategoryFilter = useMemoStore(
    state => state.clearActiveCategoryFilter,
  );
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const activeMemoIdRef = useRef<string | null>(null);
  const [isDraftingNewMemo, setDraftingNewMemo] = useState(false);
  const [text, setText] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [dateTokenAnchors, setDateTokenAnchors] = useState<MemoDateAnchor[]>(
    [],
  );
  const [dismissedTooltipKeys, setDismissedTooltipKeys] = useState<string[]>(
    [],
  );
  const [editorHeight, setEditorHeight] = useState(320);
  const [editorWidth, setEditorWidth] = useState(320);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');
  const [isNetworkVisible, setNetworkVisible] = useState(false);
  const [isMoreMenuVisible, setMoreMenuVisible] = useState(false);
  const [pendingScheduleText, setPendingScheduleText] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isNetworkLoading, setNetworkLoading] = useState(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState<string | null>(
    null,
  );
  const [networkQueryChunk, setNetworkQueryChunk] = useState<MemoChunk | null>(
    null,
  );
  const [networkResults, setNetworkResults] = useState<NetworkSearchResult[]>(
    [],
  );
  const [ambientQueryChunk, setAmbientQueryChunk] =
    useState<MemoChunk | null>(null);
  const [ambientResult, setAmbientResult] =
    useState<NetworkSearchResult | null>(null);
  const [isAmbientVisible, setAmbientVisible] = useState(false);
  const [isAmbientDetailVisible, setAmbientDetailVisible] = useState(false);
  const [sidebarViewMode, setSidebarViewMode] =
    useState<SidebarViewMode>('chronological');
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientChunkHashRef = useRef<string | null>(null);
  const lastAmbientRequestAtRef = useRef(0);
  const ambientRequestIdRef = useRef(0);

  useEffect(() => {
    setSidebarOpen(!isPhone);
  }, [isPhone]);

  useEffect(() => {
    memos.forEach(memo => {
      if (!memo.content.trim()) {
        deleteMemo(memo.id);
      }
    });
  }, [deleteMemo, memos]);

  useEffect(() => {
    activeMemoIdRef.current = activeMemoId;
  }, [activeMemoId]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    setAmbientVisible(false);

    if (ambientTimerRef.current) {
      clearTimeout(ambientTimerRef.current);
      ambientTimerRef.current = null;
    }

    const collapsedSelection = selectionStart === selectionEnd;
    const canRunAmbient =
      activeMemoId &&
      collapsedSelection &&
      text.trim().length >= AMBIENT_MIN_CHARS &&
      !isNetworkVisible &&
      !isAmbientDetailVisible &&
      (!isPhone || !isSidebarOpen);

    if (!canRunAmbient) {
      return;
    }

    const cursorWindow = getCursorChunkWindow(text, selectionStart, 0);
    const cursorChunk = cursorWindow.center;

    if (!cursorChunk || cursorChunk.text.trim().length < AMBIENT_MIN_CHARS) {
      return;
    }

    const chunkHash = hashText(`${activeMemoId}:${cursorChunk.text.trim()}`);

    ambientTimerRef.current = setTimeout(async () => {
      if (
        ambientChunkHashRef.current === chunkHash &&
        ambientQueryChunk &&
        ambientResult
      ) {
        setAmbientVisible(true);
        return;
      }

      const now = Date.now();
      if (now - lastAmbientRequestAtRef.current < AMBIENT_COOLDOWN_MS) {
        return;
      }

      const requestId = ambientRequestIdRef.current + 1;
      ambientRequestIdRef.current = requestId;
      lastAmbientRequestAtRef.current = now;

      try {
        const result = await searchCursorNetwork({
          cursorIndex: selectionStart,
          limit: AMBIENT_MAX_RESULT_COUNT,
          memoId: activeMemoId,
          text,
        });
        const firstResult = result.results[0] ?? null;

        if (ambientRequestIdRef.current !== requestId) {
          return;
        }

        if (result.queryChunk && firstResult) {
          ambientChunkHashRef.current = chunkHash;
          setAmbientQueryChunk(result.queryChunk);
          setAmbientResult(firstResult);
          setAmbientVisible(true);
        }
      } catch {
        // Ambient search is intentionally quiet. Manual network keeps visible errors.
      }
    }, AMBIENT_IDLE_DELAY_MS);

    return () => {
      if (ambientTimerRef.current) {
        clearTimeout(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
    };
  }, [
    activeMemoId,
    ambientQueryChunk,
    ambientResult,
    isAmbientDetailVisible,
    isNetworkVisible,
    isPhone,
    isSidebarOpen,
    selectionEnd,
    selectionStart,
    text,
  ]);

  const sortedMemos = useMemo(() => {
    return [...memos]
      .filter(memo => memo.content.trim())
      .filter(memo =>
        activeCategoryFilter ? memo.category === activeCategoryFilter : true,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [activeCategoryFilter, memos]);

  const sessionSections = useMemo(() => {
    const pinned = sortedMemos.filter(memo => memo.pinned);
    const unpinned = sortedMemos.filter(memo => !memo.pinned);
    const recent = unpinned.slice(0, 3);
    const remaining = unpinned.slice(3);
    const now = new Date();
    const today: Memo[] = [];
    const previousSevenDays: Memo[] = [];
    const previousThirtyDays: Memo[] = [];
    const monthSections = new Map<string, Memo[]>();
    const yearSections = new Map<string, Memo[]>();

    remaining.forEach(memo => {
      const createdAt = new Date(memo.createdAt);
      const daysAgo = differenceInCalendarDays(now, createdAt);

      if (isToday(createdAt)) {
        today.push(memo);
        return;
      }

      if (daysAgo <= 7) {
        previousSevenDays.push(memo);
        return;
      }

      if (daysAgo <= 30) {
        previousThirtyDays.push(memo);
        return;
      }

      const sectionTitle =
        createdAt.getFullYear() === now.getFullYear()
          ? format(createdAt, 'M월')
          : format(createdAt, 'yyyy년');
      const targetSections =
        createdAt.getFullYear() === now.getFullYear()
          ? monthSections
          : yearSections;

      targetSections.set(sectionTitle, [
        ...(targetSections.get(sectionTitle) ?? []),
        memo,
      ]);
    });

    return [
      {
        title: '고정',
        data: pinned,
      },
      {
        title: '최근 메모',
        data: recent,
      },
      {
        title: '오늘',
        data: today,
      },
      {
        title: '이전 7일',
        data: previousSevenDays,
      },
      {
        title: '이전 30일',
        data: previousThirtyDays,
      },
      ...Array.from(monthSections, ([title, data]) => ({ title, data })),
      ...Array.from(yearSections, ([title, data]) => ({ title, data })),
    ].filter(section => section.data.length > 0);
  }, [sortedMemos]);

  const activeMemo = useMemo(() => {
    return memos.find(memo => memo.id === activeMemoId) ?? null;
  }, [activeMemoId, memos]);

  const dateParseBase = Date.now();

  const activeMatches = useMemo(
    () => buildAnchoredDateMatches(text, dateTokenAnchors),
    [dateTokenAnchors, text],
  );

  const highlightedPieces = useMemo(() => {
    return splitHighlightedText(text, activeMatches);
  }, [activeMatches, text]);

  const focusedMatch = useMemo(() => {
    const nearest = findFocusedDateMatch(
      activeMatches,
      selectionStart,
      selectionEnd,
    );

    if (nearest && dismissedTooltipKeys.includes(nearest.text)) {
      return null;
    }

    return nearest;
  }, [activeMatches, dismissedTooltipKeys, selectionEnd, selectionStart]);

  const tooltipPosition = useMemo(() => {
    if (!focusedMatch) {
      return { left: 4, top: EDITOR_PADDING_TOP };
    }

    return getTooltipPosition(
      text,
      focusedMatch.index,
      editorHeight,
      editorWidth,
    );
  }, [editorHeight, editorWidth, focusedMatch, text]);
  const selectedText = useMemo(() => {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    return text.slice(start, end).trim();
  }, [selectionEnd, selectionStart, text]);
  const selectedDateMatch = useMemo(() => {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    return (
      activeMatches.find(
        match => match.index >= start && match.index + match.length <= end,
      ) ?? null
    );
  }, [activeMatches, selectionEnd, selectionStart]);
  const miniCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [visibleMonth]);

  useEffect(() => {
    if (!activeMemo && !isDraftingNewMemo && sortedMemos[0]) {
      activeMemoIdRef.current = sortedMemos[0].id;
      setActiveMemoId(sortedMemos[0].id);
      setText(sortedMemos[0].content);
      setDateTokenAnchors(
        reconcileDateTokenAnchors(
          sortedMemos[0].content,
          sortedMemos[0].dateAnchors ?? [],
          sortedMemos[0].createdAt,
        ),
      );
    }
  }, [activeMemo, isDraftingNewMemo, sortedMemos]);

  const handleEditorLayout = useCallback((event: LayoutChangeEvent) => {
    setEditorHeight(event.nativeEvent.layout.height);
    setEditorWidth(event.nativeEvent.layout.width);
  }, []);

  const persistCurrentMemo = useCallback(() => {
    const trimmed = text.trim();
    const currentMemoId = activeMemoIdRef.current;

    if (!trimmed) {
      if (currentMemoId) {
        deleteMemo(currentMemoId);
        activeMemoIdRef.current = null;
        setActiveMemoId(null);
      }

      return null;
    }

    if (currentMemoId) {
      updateMemo(currentMemoId, text, undefined, dateTokenAnchors);
      return currentMemoId;
    }

    const id = addMemo(text, undefined, dateTokenAnchors);
    activeMemoIdRef.current = id;
    setActiveMemoId(id);
    return id;
  }, [addMemo, dateTokenAnchors, deleteMemo, text, updateMemo]);

  const handleSelectMemo = useCallback(
    (memo: Memo) => {
      persistCurrentMemo();
      activeMemoIdRef.current = memo.id;
      setActiveMemoId(memo.id);
      setDraftingNewMemo(false);
      setText(memo.content);
      setDateTokenAnchors(
        reconcileDateTokenAnchors(
          memo.content,
          memo.dateAnchors ?? [],
          memo.createdAt,
        ),
      );
      setSelectionStart(0);
      setSelectionEnd(0);
      setDismissedTooltipKeys([]);
      if (isPhone) {
        setSidebarOpen(false);
      }
    },
    [isPhone, persistCurrentMemo],
  );

  const handleSelectDraft = useCallback(() => {
    activeMemoIdRef.current = null;
    setActiveMemoId(null);
    setDraftingNewMemo(true);
    setText('');
    setDateTokenAnchors([]);
    setSelectionStart(0);
    setSelectionEnd(0);
    setDismissedTooltipKeys([]);
    if (isPhone) {
      setSidebarOpen(false);
    }
  }, [isPhone]);

  const handleNewMemo = useCallback(() => {
    const currentMemoId = activeMemoIdRef.current;

    if (currentMemoId && !text.trim()) {
      deleteMemo(currentMemoId);
    } else {
      persistCurrentMemo();
    }
    activeMemoIdRef.current = null;
    setActiveMemoId(null);
    setDraftingNewMemo(true);
    setText('');
    setDateTokenAnchors([]);
    setSelectionStart(0);
    setSelectionEnd(0);
    setDismissedTooltipKeys([]);
    if (isPhone) {
      setSidebarOpen(false);
    }
  }, [deleteMemo, isPhone, persistCurrentMemo, text]);

  const handleChangeText = useCallback(
    (nextText: string) => {
      const nextAnchors = reconcileDateTokenAnchors(nextText, dateTokenAnchors);
      const currentMemoId = activeMemoIdRef.current;
      const trimmed = nextText.trim();

      setAmbientVisible(false);
      setText(nextText);
      setDateTokenAnchors(nextAnchors);
      setDismissedTooltipKeys(previous =>
        previous.filter(token => nextText.includes(token)),
      );

      if (!trimmed) {
        if (currentMemoId) {
          deleteMemo(currentMemoId);
          activeMemoIdRef.current = null;
          setActiveMemoId(null);
        }

        setDraftingNewMemo(true);
        return;
      }

      if (currentMemoId) {
        updateMemo(currentMemoId, nextText, undefined, nextAnchors);
        return;
      }

      const id = addMemo(nextText, undefined, nextAnchors);
      activeMemoIdRef.current = id;
      setActiveMemoId(id);
      setDraftingNewMemo(false);
    },
    [addMemo, dateTokenAnchors, deleteMemo, updateMemo],
  );

  const deleteActiveMemo = useCallback(() => {
    if (!activeMemoId) {
      return;
    }

    const remainingMemos = sortedMemos.filter(memo => memo.id !== activeMemoId);
    const nextMemo = remainingMemos[0] ?? null;

    deleteMemo(activeMemoId);

    if (nextMemo) {
      activeMemoIdRef.current = nextMemo.id;
      setActiveMemoId(nextMemo.id);
      setDraftingNewMemo(false);
      setText(nextMemo.content);
      setDateTokenAnchors(
        reconcileDateTokenAnchors(
          nextMemo.content,
          nextMemo.dateAnchors ?? [],
          nextMemo.createdAt,
        ),
      );
    } else {
      activeMemoIdRef.current = null;
      setActiveMemoId(null);
      setDraftingNewMemo(true);
      setText('');
      setDateTokenAnchors([]);
    }

    setSelectionStart(0);
    setSelectionEnd(0);
    setDismissedTooltipKeys([]);
  }, [activeMemoId, deleteMemo, sortedMemos]);

  const handleDeleteMemo = useCallback(() => {
    if (!activeMemoId) {
      return;
    }

    Alert.alert('메모 삭제', '메모를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: deleteActiveMemo,
      },
    ]);
  }, [activeMemoId, deleteActiveMemo]);

  const handleCancelMatch = useCallback((match: DateMatch) => {
    setDismissedTooltipKeys(previous => [...previous, match.text]);
  }, []);

  const handleTogglePinned = useCallback(() => {
    if (activeMemoId) {
      toggleMemoPinned(activeMemoId);
    }
  }, [activeMemoId, toggleMemoPinned]);

  const handleOpenNetwork = useCallback(async () => {
    setMoreMenuVisible(false);

    const canUseOnlineNetwork = await requireOnlineLogin('네트워크 보기');

    if (!canUseOnlineNetwork) {
      return;
    }

    setAmbientVisible(false);
    setNetworkVisible(true);
    setNetworkLoading(true);
    setNetworkErrorMessage(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);

    try {
      const result = await searchCursorNetwork({
        cursorIndex: selectionStart,
        memoId: activeMemoId,
        text,
      });
      setNetworkQueryChunk(result.queryChunk);
      setNetworkResults(result.results);
      if (result.message && result.results.length === 0) {
        setNetworkErrorMessage(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '네트워크 검색에 실패했습니다.';
      setNetworkErrorMessage(
        message.includes('login')
          ? '기기 연동 로그인 후 온라인 네트워크를 사용할 수 있습니다.'
          : '온라인 네트워크 검색을 사용할 수 없습니다. backend URL과 연결 상태를 확인해 주세요.',
      );
    } finally {
      setNetworkLoading(false);
    }
  }, [activeMemoId, selectionStart, text]);

  const handleSelectCategory = useCallback(
    (category: string) => {
      setActiveCategoryFilter(category);
      setSidebarViewMode('chronological');
    },
    [setActiveCategoryFilter],
  );

  const handleClearCategoryFilter = useCallback(() => {
    clearActiveCategoryFilter();
  }, [clearActiveCategoryFilter]);

  const handleNetworkNavigateToMemo = useCallback(
    (memoId: string) => {
      const targetMemo = memos.find(m => m.id === memoId);

      if (!targetMemo) {
        return;
      }

      setNetworkVisible(false);
      persistCurrentMemo();
      activeMemoIdRef.current = targetMemo.id;
      setActiveMemoId(targetMemo.id);
      setDraftingNewMemo(false);
      setText(targetMemo.content);
      setDateTokenAnchors(
        reconcileDateTokenAnchors(
          targetMemo.content,
          targetMemo.dateAnchors ?? [],
          targetMemo.createdAt,
        ),
      );
      setSelectionStart(0);
      setSelectionEnd(0);
      setDismissedTooltipKeys([]);
    },
    [memos, persistCurrentMemo],
  );

  const handleTogglePinnedFromMenu = useCallback(() => {
    setMoreMenuVisible(false);
    handleTogglePinned();
  }, [handleTogglePinned]);

  const handleDeleteFromMenu = useCallback(() => {
    setMoreMenuVisible(false);
    handleDeleteMemo();
  }, [handleDeleteMemo]);

  const handleOpenMemoList = useCallback(() => {
    Keyboard.dismiss();
    setMoreMenuVisible(false);
    setSidebarOpen(true);
  }, []);

  const insertToken = useCallback(
    (token: string) => {
      const insertIndex = Math.max(selectionStart, selectionEnd);
      const prefix = text.slice(0, insertIndex);
      const suffix = text.slice(insertIndex);
      const needsLeadingSpace = prefix.length > 0 && !/\s$/.test(prefix);
      const needsTrailingSpace = suffix.length > 0 && !/^\s/.test(suffix);
      const insertion = `${needsLeadingSpace ? ' ' : ''}${token}${
        needsTrailingSpace ? ' ' : ''
      }`;
      const nextText = `${prefix}${insertion}${suffix}`;
      const nextCursor = prefix.length + insertion.length;

      handleChangeText(nextText);
      setSelectionStart(nextCursor);
      setSelectionEnd(nextCursor);
    },
    [handleChangeText, selectionEnd, selectionStart, text],
  );

  const showScheduleRegisteredAlert = useCallback((content: string) => {
    const title = content.length > 30 ? `${content.slice(0, 30)}...` : content;

    setTimeout(() => {
      Alert.alert('일정 등록', `"${title}" 일정이 등록되었습니다.`);
    }, 250);
  }, []);

  const registerSelectedTextSchedule = useCallback(
    (content: string, scheduledAt: number) => {
      const trimmed = content.trim();

      if (!trimmed) {
        return;
      }

      Keyboard.dismiss();
      addScheduleFromSelection(trimmed, scheduledAt);
      setDateModalVisible(false);
      setScheduleHour('');
      setScheduleMinute('');
      setPendingScheduleText('');
      setSelectionEnd(selectionStart);
      showScheduleRegisteredAlert(trimmed);
    },
    [addScheduleFromSelection, selectionStart, showScheduleRegisteredAlert],
  );

  const handleScheduleSelection = useCallback(() => {
    const selectedMatch =
      parseDates(selectedText, Date.now())[0] ?? selectedDateMatch;

    if (selectedMatch) {
      registerSelectedTextSchedule(selectedText, selectedMatch.date.getTime());
      return;
    }

    setPendingScheduleText(selectedText);
    Keyboard.dismiss();
    setDateModalVisible(true);
  }, [registerSelectedTextSchedule, selectedDateMatch, selectedText]);

  const handleApplyDate = useCallback(
    (date: Date) => {
      const h = parseInt(scheduleHour, 10);
      const m = parseInt(scheduleMinute, 10);
      const hasTime = !isNaN(h) && h >= 0 && h <= 23;
      const finalDate = new Date(date);
      if (hasTime) {
        finalDate.setHours(h, isNaN(m) ? 0 : Math.min(m, 59), 0, 0);
      }

      if (pendingScheduleText || selectedText) {
        registerSelectedTextSchedule(
          pendingScheduleText || selectedText,
          finalDate.getTime(),
        );
      } else {
        insertToken(format(finalDate, hasTime ? 'yy.MM.dd HH:mm' : 'yy.MM.dd'));
        setDateModalVisible(false);
        setScheduleHour('');
        setScheduleMinute('');
      }
    },
    [
      insertToken,
      pendingScheduleText,
      registerSelectedTextSchedule,
      scheduleHour,
      scheduleMinute,
      selectedText,
    ],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {isPhone && !isSidebarOpen && (
              <Pressable
                accessibilityLabel="메모 목록"
                hitSlop={8}
                onPress={handleOpenMemoList}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.controlPressed,
                ]}
              >
                <ChevronLeft size={22} color="#5C4D3C" />
              </Pressable>
            )}
            <View>
              <Text style={styles.title}>메모</Text>
              {!isPhone && (
                <Text style={styles.subtitle}>
                  날짜를 감지한 뒤 선택해서 일정으로 등록합니다
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            {!(isPhone && isSidebarOpen) && (
              <Pressable
                accessibilityLabel="메모 옵션"
                hitSlop={6}
                onPress={() => setMoreMenuVisible(previous => !previous)}
                style={({ pressed }) => [
                  styles.iconButton,
                  isMoreMenuVisible && styles.iconButtonActive,
                  pressed && styles.controlPressed,
                ]}
              >
                <MoreHorizontal size={20} color="#5C4D3C" />
              </Pressable>
            )}
            <Pressable
              accessibilityLabel="새 메모"
              hitSlop={6}
              onPress={handleNewMemo}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.controlPressed,
              ]}
            >
              <Plus size={19} color="#5C4D3C" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {(!isPhone || isSidebarOpen) && (
            <MemoSidebar
              activeCategoryFilter={activeCategoryFilter}
              activeMemoId={activeMemoId}
              isDraftingNewMemo={isDraftingNewMemo}
              isPhone={isPhone}
              memoCount={sortedMemos.length}
              onClearCategoryFilter={handleClearCategoryFilter}
              onSelectCategory={handleSelectCategory}
              onSelectDraft={handleSelectDraft}
              onSelectMemo={handleSelectMemo}
              sections={sessionSections}
              viewMode={sidebarViewMode}
              onChangeViewMode={setSidebarViewMode}
            />
          )}

          {(!isPhone || !isSidebarOpen) && (
            <MemoEditor
              dateParseBase={dateParseBase}
              focusedMatch={focusedMatch}
              formatTooltip={formatDateMatchTooltip}
              highlightedPieces={highlightedPieces}
              inputAccessoryViewID={
                Platform.OS === 'ios' ? DATE_ACTIONS_ACCESSORY_ID : undefined
              }
              onCancelMatch={handleCancelMatch}
              onChangeText={handleChangeText}
              onLayout={handleEditorLayout}
              onScheduleSelection={handleScheduleSelection}
              onSelectionChange={(start, end) => {
                setSelectionStart(start);
                setSelectionEnd(end);
              }}
              selectedText={selectedText}
              text={text}
              tooltipLeft={tooltipPosition.left}
              tooltipTop={tooltipPosition.top}
            />
          )}
        </View>

        {isAmbientVisible &&
          ambientQueryChunk &&
          ambientResult &&
          !isNetworkVisible &&
          (!isPhone || !isSidebarOpen) && (
            <View
              pointerEvents="box-none"
              style={styles.ambientCardLayer}
            >
              <AmbientNetworkCard
                onPress={() => {
                  setAmbientVisible(false);
                  setAmbientDetailVisible(true);
                }}
                queryChunk={ambientQueryChunk}
                result={ambientResult}
              />
            </View>
          )}
      </KeyboardAvoidingView>

      {isMoreMenuVisible && (
        <>
          <Pressable
            accessibilityLabel="메모 옵션 닫기"
            onPress={() => setMoreMenuVisible(false)}
            style={styles.moreMenuBackdrop}
          />
          <View style={styles.moreMenu}>
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenNetwork}
              style={({ pressed }) => [
                styles.moreMenuItem,
                pressed && styles.moreMenuItemPressed,
              ]}
            >
              <Network size={17} color="#5C4D3C" />
              <Text style={styles.moreMenuText}>네트워크 보기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!activeMemoId}
              onPress={handleTogglePinnedFromMenu}
              style={({ pressed }) => [
                styles.moreMenuItem,
                !activeMemoId && styles.moreMenuItemDisabled,
                pressed && activeMemoId && styles.moreMenuItemPressed,
              ]}
            >
              <Text style={styles.moreMenuIconText}>핀</Text>
              <Text
                style={[
                  styles.moreMenuText,
                  !activeMemoId && styles.moreMenuTextDisabled,
                ]}
              >
                {activeMemo?.pinned ? '고정 해제' : '메모 고정'}
              </Text>
            </Pressable>
            <View style={styles.moreMenuDivider} />
            <Pressable
              accessibilityRole="button"
              disabled={!activeMemoId}
              onPress={handleDeleteFromMenu}
              style={({ pressed }) => [
                styles.moreMenuItem,
                !activeMemoId && styles.moreMenuItemDisabled,
                pressed && activeMemoId && styles.moreMenuItemPressed,
              ]}
            >
              <Trash2 size={17} color={activeMemoId ? '#B5453A' : '#9C8E7C'} />
              <Text
                style={[
                  styles.moreMenuText,
                  styles.moreMenuDeleteText,
                  !activeMemoId && styles.moreMenuTextDisabled,
                ]}
              >
                메모 삭제
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={DATE_ACTIONS_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <DateQuickActions
              onDismissKeyboard={Keyboard.dismiss}
              onInsertToken={insertToken}
              onOpenCalendar={() => setDateModalVisible(true)}
            />
          </View>
        </InputAccessoryView>
      ) : (
        isKeyboardVisible && (
          <View
            style={[styles.keyboardAccessory, styles.keyboardAccessoryFloating]}
          >
            <DateQuickActions
              onDismissKeyboard={Keyboard.dismiss}
              onInsertToken={insertToken}
              onOpenCalendar={() => setDateModalVisible(true)}
            />
          </View>
        )
      )}

      {isDateModalVisible && (
        <MiniCalendarPopover
          days={miniCalendarDays}
          hour={scheduleHour}
          minute={scheduleMinute}
          onApplyDate={handleApplyDate}
          onClose={() => {
            setDateModalVisible(false);
            setScheduleHour('');
            setScheduleMinute('');
          }}
          setHour={setScheduleHour}
          setMinute={setScheduleMinute}
          setVisibleMonth={setVisibleMonth}
          visibleMonth={visibleMonth}
        />
      )}

      <MemoNetworkPanel
        errorMessage={networkErrorMessage}
        isLoading={isNetworkLoading}
        onClose={() => setNetworkVisible(false)}
        onNavigateToMemo={handleNetworkNavigateToMemo}
        queryChunk={networkQueryChunk}
        results={networkResults}
        visible={isNetworkVisible}
      />
      <AmbientNetworkDetailPanel
        onClose={() => setAmbientDetailVisible(false)}
        onNavigateToMemo={memoId => {
          setAmbientDetailVisible(false);
          handleNetworkNavigateToMemo(memoId);
        }}
        queryChunk={ambientQueryChunk}
        result={ambientResult}
        visible={isAmbientDetailVisible}
      />
    </SafeAreaView>
  );
};

const editorTextBase = {
  fontSize: 19,
  lineHeight: EDITOR_LINE_HEIGHT,
  paddingHorizontal: 4,
  paddingTop: EDITOR_PADDING_TOP,
} as const;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF6F0',
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  title: {
    color: '#2C2520',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#9C8E7C',
    fontSize: 13,
    marginTop: 3,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  pinButton: {
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    marginRight: 8,
    minHeight: 36,
    paddingHorizontal: 13,
    paddingVertical: 8,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  pinButtonActive: {
    backgroundColor: '#5C4D3C',
    borderColor: '#5C4D3C',
  },
  pinButtonDisabled: {
    opacity: 0.35,
  },
  pinButtonText: {
    color: '#2C2520',
    fontSize: 12,
    fontWeight: '800',
  },
  pinButtonTextActive: {
    color: '#FAF6F0',
  },
  pinButtonTextDisabled: {
    color: '#9C8E7C',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    width: 36,
  },
  iconButtonActive: {
    backgroundColor: '#EDE6D8',
  },
  controlPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  ambientCardLayer: {
    bottom: 26,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 60,
  },
  sessionRail: {
    borderRightColor: '#E5DDD0',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 8,
    width: 190,
  },
  sessionRailPhone: {
    backgroundColor: '#FAF6F0',
    borderRightWidth: 0,
    elevation: 10,
    left: 0,
    position: 'absolute',
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    top: 0,
    bottom: 0,
    width: 240,
    zIndex: 50,
  },
  sidebarOverlay: {
    backgroundColor: 'rgba(44, 37, 32, 0.15)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  sessionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  sessionTitle: {
    color: '#2C2520',
    fontSize: 12,
    fontWeight: '800',
  },
  sessionCount: {
    color: '#9C8E7C',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionSection: {
    marginBottom: 18,
  },
  sessionSectionTitle: {
    color: '#2C2520',
    fontSize: 20,
    fontWeight: '800',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  memoRow: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  memoRowActive: {
    backgroundColor: '#EDE6D8',
  },
  memoRowTitle: {
    color: '#2C2520',
    fontSize: 13,
    fontWeight: '700',
  },
  memoRowMeta: {
    color: '#9C8E7C',
    fontSize: 11,
    marginTop: 4,
  },
  editorColumn: {
    flex: 1,
    position: 'relative',
  },
  paperBackSheet: {
    backgroundColor: '#F2E69E',
    bottom: 12,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 26,
  },
  editorShell: {
    backgroundColor: '#FFF2A8',
    borderColor: '#E1D68F',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginBottom: 18,
    marginHorizontal: 18,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
  },
  linedPaper: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  paperLine: {
    backgroundColor: 'rgba(95, 141, 150, 0.28)',
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  highlightedDate: {
    color: '#2E7D4F',
    fontWeight: '700',
  },
  placeholder: {
    ...editorTextBase,
    color: '#B7B7BD',
    position: 'absolute',
    zIndex: 3,
  },
  editor: {
    ...editorTextBase,
    color: 'transparent',
    flex: 1,
    zIndex: 1,
  },
  selectionFloatingToolbar: {
    position: 'absolute',
    right: 10,
  },
  selectionFloatingButton: {
    alignItems: 'center',
    backgroundColor: '#5C4D3C',
    borderRadius: 8,
    height: SELECTION_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  selectionFloatingText: {
    color: '#FAF6F0',
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipLayer: {
    left: 4,
    maxWidth: '92%',
    position: 'absolute',
    zIndex: 30,
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: '#EAF6ED',
    borderColor: '#BBDDC5',
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: TOOLTIP_HEIGHT,
    paddingLeft: 11,
    paddingRight: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  tooltipText: {
    color: '#236B45',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 270,
  },
  tooltipClose: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 7,
    width: 26,
  },
  keyboardAccessory: {
    backgroundColor: '#F5EFE5',
    borderTopColor: '#E5DDD0',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    paddingTop: 8,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  keyboardAccessoryFloating: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 90,
  },
  moreMenuBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 70,
  },
  moreMenu: {
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    position: 'absolute',
    right: 18,
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    top: 66,
    width: 188,
    zIndex: 80,
  },
  moreMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 13,
  },
  moreMenuItemPressed: {
    backgroundColor: '#EDE6D8',
  },
  moreMenuItemDisabled: {
    opacity: 0.45,
  },
  moreMenuText: {
    color: '#2C2520',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  moreMenuTextDisabled: {
    color: '#9C8E7C',
  },
  moreMenuIconText: {
    color: '#2C2520',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    width: 17,
  },
  moreMenuDeleteText: {
    color: '#B5453A',
  },
  moreMenuDivider: {
    backgroundColor: '#E5DDD0',
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
    marginVertical: 4,
  },
  dateAccessoryChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dateAccessoryText: {
    color: '#4257B2',
    fontSize: 12,
    fontWeight: '700',
  },
  datePopover: {
    backgroundColor: '#6AA35D',
    borderRadius: 6,
    padding: 18,
    position: 'absolute',
    right: 22,
    top: 126,
    width: 340,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  monthButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },
  monthNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: 43,
  },
  miniCalendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 4,
    height: 34,
    justifyContent: 'center',
    width: 43,
  },
  calendarDayMuted: {
    opacity: 0.28,
  },
  calendarDayToday: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  calendarDayNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  datePanelActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  dateTextAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateCancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  timeInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  timeInputLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  timeInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    width: 48,
  },
  timeColon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  networkBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  networkPanel: {
    backgroundColor: '#FAFAF8',
    borderRadius: 8,
    height: '82%',
    overflow: 'hidden',
    width: '100%',
  },
  networkHeader: {
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderBottomColor: '#E5E0D6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  networkTitle: {
    color: '#1D1D1F',
    fontSize: 22,
    fontWeight: '800',
  },
  networkSubtitle: {
    color: '#8A8A8E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
});

export default MemoScreen;
