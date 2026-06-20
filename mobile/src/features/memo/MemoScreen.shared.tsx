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
  Linking,
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
  Columns2,
  MoreHorizontal,
  Network,
  Plus,
  Trash2,
} from 'lucide-react-native';

import {
  DateMatch,
  parseDates,
} from '../../lib/dateParser';
import {
  buildAnchoredDateMatches,
  findFocusedDateMatch,
  formatDateMatchTooltip,
  getDateMatchDismissKey,
  reconcileDateTokenAnchors,
  splitHighlightedText,
} from './model/dateAnchors';
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
} from '../network/services/networkService';
import { requireOnlineLogin } from '../../shared/supabase/authGate';
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
import MemoSplitWorkspace, {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './components/MemoSplitWorkspace';
import MarkdownToolbar from './components/MarkdownToolbar';
import MiniCalendarPopover from './components/MiniCalendarPopover';

const EDITOR_LINE_HEIGHT = 22;
const SELECTION_TOOLBAR_HEIGHT = 32;
const DATE_ACTIONS_ACCESSORY_ID = 'memo-date-actions-accessory';
const MEMO_WRITE_DEBOUNCE_MS = 500;
const MAX_SPLIT_PANE_COUNT = 3;
const editorFontFamily =
  Platform.OS === 'macos' ? 'Apple SD Gothic Neo' : undefined;

interface MemoScreenProps {
  enableSplitWorkspace?: boolean;
}

const createSplitPane = (
  view: MemoSplitPaneView = 'memo',
): MemoSplitPaneState => ({
  id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  mode: view === 'memo' ? 'draft' : undefined,
  view,
});

const isSplitPaneBlankMemoDraft = (pane: MemoSplitPaneState) => {
  const activeEditor =
    pane.editors?.find(editor => editor.id === pane.activeEditorId) ??
    pane.editors?.[0];

  if (activeEditor) {
    return (
      activeEditor.view === 'memo' &&
      !activeEditor.memoId &&
      !activeEditor.sourceResult &&
      !(activeEditor.draftText ?? '').trim()
    );
  }

  return (
    pane.view === 'memo' &&
    !pane.memoId &&
    !pane.sourceResult &&
    !(pane.draftText ?? '').trim()
  );
};

const appendOrReplaceSplitPane = (
  panes: MemoSplitPaneState[],
  nextPane: MemoSplitPaneState,
) => {
  if (panes.length === 0) {
    return [nextPane];
  }

  const lastPane = panes[panes.length - 1];

  if (isSplitPaneBlankMemoDraft(lastPane)) {
    return panes.map((pane, index) =>
      index === panes.length - 1
        ? {
            ...nextPane,
            id: pane.id,
          }
        : pane,
    );
  }

  if (panes.length < MAX_SPLIT_PANE_COUNT) {
    return [...panes, nextPane];
  }

  return panes.map((pane, index) =>
    index === panes.length - 1 ? nextPane : pane,
  );
};

// Date-anchor + highlight helpers live in ./model/dateAnchors so they can be
// shared by per-panel date detection (see useDateSchedule).

const MemoScreen = ({ enableSplitWorkspace = false }: MemoScreenProps = {}) => {
  const { width: screenWidth } = useWindowDimensions();
  const isMac = Platform.OS === 'macos';
  const isPhone = !isMac && screenWidth < 768;
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
  // Non-empty memos in the same order the sidebar shows them (category filter
  // applied, newest first). Used for auto-selecting the first memo and for
  // picking the neighbor memo after a deletion.
  const sortedMemos = useMemo(
    () =>
      [...memos]
        .filter(memo => memo.content.trim())
        .filter(memo =>
          activeCategoryFilter ? memo.category === activeCategoryFilter : true,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [memos, activeCategoryFilter],
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
  const [ambientQueryChunk, setAmbientQueryChunk] = useState<MemoChunk | null>(
    null,
  );
  const [ambientResults, setAmbientResults] = useState<NetworkSearchResult[]>(
    [],
  );
  const [selectedAmbientResult, setSelectedAmbientResult] =
    useState<NetworkSearchResult | null>(null);
  const [isAmbientVisible, setAmbientVisible] = useState(false);
  const [isAmbientPreviewVisible, setAmbientPreviewVisible] = useState(false);
  const [isAmbientDetailVisible, setAmbientDetailVisible] = useState(false);
  const [sidebarViewMode, setSidebarViewMode] =
    useState<SidebarViewMode>('chronological');
  const [splitPanes, setSplitPanes] = useState<MemoSplitPaneState[]>([]);
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [dismissedFocusedDateKey, setDismissedFocusedDateKey] = useState<
    string | null
  >(null);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientChunkHashRef = useRef<string | null>(null);
  const lastAmbientRequestAtRef = useRef(0);
  const ambientRequestIdRef = useRef(0);
  const memoPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingMemoWriteRef = useRef<{
    content: string;
    dateAnchors: MemoDateAnchor[];
    id: string;
  } | null>(null);
  const lastScheduleSelectionRef = useRef<{
    match: DateMatch | null;
    text: string;
  } | null>(null);
  const openMemoPanelNumbers = useMemo(() => {
    const openMap: Record<string, number[]> = {};
    const addOpenMemo = (memoId: string | undefined, panelNumber: number) => {
      if (!memoId) {
        return;
      }

      openMap[memoId] = [...(openMap[memoId] ?? []), panelNumber];
    };

    if (!isMac || !enableSplitWorkspace) {
      addOpenMemo(activeMemoId ?? undefined, 1);
      return openMap;
    }

    splitPanes.slice(0, MAX_SPLIT_PANE_COUNT).forEach((pane, index) => {
      const panelNumber = index + 1;
      const editors =
        pane.editors && pane.editors.length > 0
          ? pane.editors
          : ([
              {
                memoId: pane.memoId,
                view: pane.view,
              },
            ] as MemoSplitEditorState[]);

      editors.forEach(editor => {
        if (editor.view === 'memo') {
          addOpenMemo(editor.memoId, panelNumber);
        }
      });
    });

    return Object.fromEntries(
      Object.entries(openMap).map(([memoId, panelNumbers]) => [
        memoId,
        Array.from(new Set(panelNumbers)).sort((a, b) => a - b),
      ]),
    );
  }, [activeMemoId, enableSplitWorkspace, isMac, splitPanes]);

  useEffect(() => {
    setSidebarOpen(!isPhone);
  }, [isPhone]);

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

  const handleAmbientIdle = useCallback(async (chunkText: string) => {
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
      !isAmbientPreviewVisible &&
      !isAmbientDetailVisible &&
      (!isPhone || !isSidebarOpen);

    if (!canRunAmbient) {
      return;
    }

    const chunkHash = hashText(`${activeMemoId}:${chunkText.trim()}`);

    if (
      ambientChunkHashRef.current === chunkHash &&
      ambientQueryChunk &&
      ambientResults.length > 0
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
      const nextAmbientResults = result.results.slice(0, 2);

      if (ambientRequestIdRef.current !== requestId) {
        return;
      }

      if (result.queryChunk && nextAmbientResults.length > 0) {
        ambientChunkHashRef.current = chunkHash;
        setAmbientQueryChunk(result.queryChunk);
        setAmbientResults(nextAmbientResults);
        setSelectedAmbientResult(nextAmbientResults[0]);
        setAmbientVisible(true);
      }
    } catch {
      // Ambient search is intentionally quiet.
    }
  }, [
    activeMemoId,
    ambientQueryChunk,
    ambientResults.length,
    isAmbientDetailVisible,
    isAmbientPreviewVisible,
    isNetworkVisible,
    isPhone,
    isSidebarOpen,
    selectionEnd,
    selectionStart,
    text,
  ]);



  const activeMemo = useMemo(() => {
    return memos.find(memo => memo.id === activeMemoId) ?? null;
  }, [activeMemoId, memos]);

  const editorTitle = useMemo(() => {
    const firstLine = text.trim().split('\n')[0]?.trim();
    if (!firstLine) {
      return '새 기록';
    }

    return firstLine.length > 28 ? `${firstLine.slice(0, 28)}...` : firstLine;
  }, [text]);

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

    if (
      nearest &&
      (nearest.dismissed ||
        dismissedFocusedDateKey === getDateMatchDismissKey(nearest))
    ) {
      return null;
    }

    return nearest;
  }, [activeMatches, dismissedFocusedDateKey, selectionEnd, selectionStart]);

  const focusedDateLabel = focusedMatch
    ? formatDateMatchTooltip(focusedMatch, dateParseBase)
    : null;
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

  useEffect(() => {
    if (!selectedText) {
      return;
    }

    lastScheduleSelectionRef.current = {
      match: parseDates(selectedText, Date.now())[0] ?? selectedDateMatch,
      text: selectedText,
    };
  }, [selectedDateMatch, selectedText]);
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

  const discardPendingMemoWrite = useCallback((memoId?: string | null) => {
    const pending = pendingMemoWriteRef.current;

    if (memoId && pending?.id !== memoId) {
      return;
    }

    if (memoPersistTimerRef.current) {
      clearTimeout(memoPersistTimerRef.current);
      memoPersistTimerRef.current = null;
    }

    pendingMemoWriteRef.current = null;
  }, []);

  const flushPendingMemoWrite = useCallback(
    (memoId?: string | null) => {
      const pending = pendingMemoWriteRef.current;

      if (!pending || (memoId && pending.id !== memoId)) {
        return;
      }

      if (memoPersistTimerRef.current) {
        clearTimeout(memoPersistTimerRef.current);
        memoPersistTimerRef.current = null;
      }

      pendingMemoWriteRef.current = null;

      const currentMemo = useMemoStore
        .getState()
        .memos.find(memo => memo.id === pending.id);

      if (!currentMemo) {
        return;
      }

      const currentAnchors = JSON.stringify(currentMemo.dateAnchors ?? []);
      const nextAnchors = JSON.stringify(pending.dateAnchors ?? []);

      if (
        currentMemo.content === pending.content &&
        currentAnchors === nextAnchors
      ) {
        return;
      }

      updateMemo(pending.id, pending.content, undefined, pending.dateAnchors);
    },
    [updateMemo],
  );

  const scheduleMemoWrite = useCallback(
    (memoId: string, content: string, anchors: MemoDateAnchor[]) => {
      pendingMemoWriteRef.current = {
        content,
        dateAnchors: anchors,
        id: memoId,
      };

      if (memoPersistTimerRef.current) {
        clearTimeout(memoPersistTimerRef.current);
      }

      memoPersistTimerRef.current = setTimeout(() => {
        flushPendingMemoWrite();
      }, MEMO_WRITE_DEBOUNCE_MS);
    },
    [flushPendingMemoWrite],
  );

  useEffect(() => {
    return () => {
      flushPendingMemoWrite();
    };
  }, [flushPendingMemoWrite]);

  const persistCurrentMemo = useCallback(() => {
    const trimmed = text.trim();
    const currentMemoId = activeMemoIdRef.current;

    if (!trimmed) {
      if (currentMemoId) {
        discardPendingMemoWrite(currentMemoId);
        deleteMemo(currentMemoId);
        activeMemoIdRef.current = null;
        setActiveMemoId(null);
      }

      return null;
    }

    if (currentMemoId) {
      discardPendingMemoWrite(currentMemoId);
      updateMemo(currentMemoId, text, undefined, dateTokenAnchors);
      return currentMemoId;
    }

    const id = addMemo(text, undefined, dateTokenAnchors);
    activeMemoIdRef.current = id;
    setActiveMemoId(id);
    return id;
  }, [
    addMemo,
    dateTokenAnchors,
    deleteMemo,
    discardPendingMemoWrite,
    text,
    updateMemo,
  ]);

  const isSplitWorkspaceEnabled = enableSplitWorkspace && isMac;
  const hasSplitPanes = isSplitWorkspaceEnabled && splitPanes.length > 0;
  const canAddSplitPane =
    isSplitWorkspaceEnabled && splitPanes.length < MAX_SPLIT_PANE_COUNT;

  const handleAddSplitPane = useCallback(() => {
    if (!isSplitWorkspaceEnabled) {
      return;
    }

    setSplitPanes(previous => {
      if (previous.length >= MAX_SPLIT_PANE_COUNT) {
        return previous;
      }

      return [...previous, createSplitPane()];
    });
  }, [isSplitWorkspaceEnabled]);

  const handleChangeSplitPane = useCallback(
    (id: string, patch: Partial<MemoSplitPaneState>) => {
      setSplitPanes(previous =>
        previous.map(pane =>
          pane.id === id
            ? {
                ...pane,
                ...patch,
              }
            : pane,
        ),
      );
    },
    [],
  );

  const handleCloseSplitPane = useCallback((id: string) => {
    // Always keep at least one pane — closing the last one resets it to a
    // fresh blank draft rather than leaving an empty workspace.
    setSplitPanes(previous => {
      const next = previous.filter(pane => pane.id !== id);
      return next.length > 0 ? next : [createSplitPane('memo')];
    });
  }, []);

  // The macOS workspace replaces the (removed) main editor, so it must always
  // have at least one pane to edit in.
  useEffect(() => {
    if (!isSplitWorkspaceEnabled || splitPanes.length > 0) {
      return;
    }

    const seedMemo = sortedMemos[0];
    setSplitPanes([
      seedMemo
        ? {
            ...createSplitPane('memo'),
            memoId: seedMemo.id,
            mode: 'existing',
          }
        : createSplitPane('memo'),
    ]);
  }, [isSplitWorkspaceEnabled, splitPanes.length, sortedMemos]);

  const openMemoInFocusedPane = useCallback(
    (memo: Memo) => {
      if (!isSplitWorkspaceEnabled) {
        return false;
      }

      setSplitPanes(previous => {
        const targetId =
          focusedPaneId && previous.some(pane => pane.id === focusedPaneId)
            ? focusedPaneId
            : previous[previous.length - 1]?.id;

        if (!targetId) {
          return [
            { ...createSplitPane('memo'), memoId: memo.id, mode: 'existing' },
          ];
        }

        const nextEditor: MemoSplitEditorState = {
          id: `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          memoId: memo.id,
          mode: 'existing',
          view: 'memo',
        };

        return previous.map(pane => {
          if (pane.id !== targetId) {
            return pane;
          }

          // Replace only the active editor/tab — keep the pane's other tabs.
          const editors =
            pane.editors && pane.editors.length > 0
              ? pane.editors
              : [
                  {
                    draftText: pane.draftText,
                    id: pane.activeEditorId ?? `${pane.id}-editor`,
                    memoId: pane.memoId,
                    mode: pane.mode,
                    view: pane.view,
                  } as MemoSplitEditorState,
                ];
          const activeId = pane.activeEditorId ?? editors[0]?.id;

          return {
            ...pane,
            activeEditorId: nextEditor.id,
            editors: editors.map(editor =>
              editor.id === activeId ? nextEditor : editor,
            ),
            highlight: null,
            memoId: memo.id,
            mode: 'existing',
            view: 'memo',
          };
        });
      });

      return true;
    },
    [focusedPaneId, isSplitWorkspaceEnabled],
  );

  const openAmbientResultInSplit = useCallback(
    (result: NetworkSearchResult) => {
      if (!isSplitWorkspaceEnabled) {
        return false;
      }

      const nextPane: MemoSplitPaneState =
        result.sourceKind === 'memo' && result.memoId
          ? {
              ...createSplitPane('memo'),
              highlight: {
                chunkText: result.chunkText,
                endIndex: result.endIndex,
                startIndex: result.startIndex,
              },
              memoId: result.memoId,
              mode: 'existing',
            }
          : {
              ...createSplitPane('source'),
              sourceResult: result,
            };

      setSplitPanes(previous => appendOrReplaceSplitPane(previous, nextPane));

      setAmbientPreviewVisible(false);
      setAmbientVisible(false);
      return true;
    },
    [isSplitWorkspaceEnabled],
  );

  const openNetworkSearchInSplit = useCallback(
    (patch: Partial<MemoSplitPaneState> = {}) => {
      const networkRequestId =
        patch.networkRequestId ??
        `network-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextPane: MemoSplitPaneState = {
        ...createSplitPane('network'),
        networkRequestId,
        ...patch,
      };

      setSplitPanes(previous => appendOrReplaceSplitPane(previous, nextPane));

      return networkRequestId;
    },
    [],
  );

  const openGlobalNetworkInSplit = useCallback(() => {
    if (!isSplitWorkspaceEnabled) {
      setSidebarViewMode('network');
      return;
    }

    const nextPane = createSplitPane('network');

    setSplitPanes(previous => {
      const hasGlobalNetworkPane = previous.some(
        pane =>
          pane.view === 'network' &&
          !pane.networkIsLoading &&
          !pane.networkQueryChunk &&
          !pane.networkResults &&
          !pane.networkErrorMessage,
      );

      if (hasGlobalNetworkPane) {
        return previous;
      }

      return appendOrReplaceSplitPane(previous, nextPane);
    });

    setSidebarViewMode('chronological');
  }, [isSplitWorkspaceEnabled]);

  const handleChangeSidebarViewMode = useCallback(
    (mode: SidebarViewMode) => {
      if (mode === 'network') {
        openGlobalNetworkInSplit();
        return;
      }

      clearActiveCategoryFilter();
      setSidebarViewMode(mode);
    },
    [clearActiveCategoryFilter, openGlobalNetworkInSplit],
  );

  const updateNetworkSearchSplit = useCallback(
    (networkRequestId: string, patch: Partial<MemoSplitPaneState>) => {
      setSplitPanes(previous =>
        previous.map(pane =>
          pane.networkRequestId === networkRequestId
            ? {
                ...pane,
                ...patch,
              }
            : pane,
        ),
      );
    },
    [],
  );

  const handleSelectMemo = useCallback(
    (memo: Memo) => {
      if (hasSplitPanes && openMemoInFocusedPane(memo)) {
        return;
      }

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
      if (isPhone) {
        setSidebarOpen(false);
      }
    },
    [hasSplitPanes, isPhone, openMemoInFocusedPane, persistCurrentMemo],
  );

  const handleSelectDraft = useCallback(() => {
    persistCurrentMemo();
    activeMemoIdRef.current = null;
    setActiveMemoId(null);
    setDraftingNewMemo(true);
    setText('');
    setDateTokenAnchors([]);
    setSelectionStart(0);
    setSelectionEnd(0);
    if (isPhone) {
      setSidebarOpen(false);
    }
  }, [isPhone, persistCurrentMemo]);

  const handleNewMemo = useCallback(() => {
    const currentMemoId = activeMemoIdRef.current;

    if (currentMemoId && !text.trim()) {
      discardPendingMemoWrite(currentMemoId);
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
    if (isPhone) {
      setSidebarOpen(false);
    }
  }, [deleteMemo, discardPendingMemoWrite, isPhone, persistCurrentMemo, text]);

  const handleChangeText = useCallback(
    (nextText: string) => {
      const nextAnchors = reconcileDateTokenAnchors(nextText, dateTokenAnchors);
      const currentMemoId = activeMemoIdRef.current;
      const trimmed = nextText.trim();

      setAmbientVisible(false);
      setDismissedFocusedDateKey(null);
      lastScheduleSelectionRef.current = null;
      setText(nextText);
      setDateTokenAnchors(nextAnchors);

      if (!trimmed) {
        if (currentMemoId) {
          discardPendingMemoWrite(currentMemoId);
          deleteMemo(currentMemoId);
          activeMemoIdRef.current = null;
          setActiveMemoId(null);
        }

        setDraftingNewMemo(true);
        return;
      }

      if (currentMemoId) {
        scheduleMemoWrite(currentMemoId, nextText, nextAnchors);
        return;
      }

      const id = addMemo(nextText, undefined, nextAnchors);
      activeMemoIdRef.current = id;
      setActiveMemoId(id);
      setDraftingNewMemo(false);
    },
    [
      addMemo,
      dateTokenAnchors,
      deleteMemo,
      discardPendingMemoWrite,
      scheduleMemoWrite,
    ],
  );

  const deleteActiveMemo = useCallback(() => {
    if (!activeMemoId) {
      return;
    }

    const remainingMemos = sortedMemos.filter(memo => memo.id !== activeMemoId);
    const nextMemo = remainingMemos[0] ?? null;

    discardPendingMemoWrite(activeMemoId);
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
  }, [activeMemoId, deleteMemo, discardPendingMemoWrite, sortedMemos]);

  const handleDeleteMemo = useCallback(() => {
    if (!activeMemoId) {
      return;
    }

    Alert.alert('노트 삭제', '삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: deleteActiveMemo,
      },
    ]);
  }, [activeMemoId, deleteActiveMemo]);

  const handleCancelMatch = useCallback(
    (match: DateMatch) => {
      let didDismiss = false;
      const nextAnchors = dateTokenAnchors.map(anchor => {
        const currentAnchorText = text.slice(
          anchor.index,
          anchor.index + anchor.length,
        );
        const sameRange =
          anchor.index === match.index && anchor.length === match.length;

        if (
          sameRange &&
          (anchor.text === match.text || currentAnchorText === match.text)
        ) {
          didDismiss = true;
          return { ...anchor, dismissed: true };
        }
        return anchor;
      });

      if (!didDismiss) {
        return;
      }

      setDateTokenAnchors(nextAnchors);

      const currentMemoId = activeMemoIdRef.current;
      if (currentMemoId) {
        discardPendingMemoWrite(currentMemoId);
        updateMemo(currentMemoId, text, undefined, nextAnchors);
      }
    },
    [dateTokenAnchors, discardPendingMemoWrite, text, updateMemo],
  );

  const handleDismissFocusedDate = useCallback(() => {
    if (focusedMatch) {
      setDismissedFocusedDateKey(getDateMatchDismissKey(focusedMatch));
      handleCancelMatch(focusedMatch);
    }
  }, [focusedMatch, handleCancelMatch]);

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

    if (isSplitWorkspaceEnabled) {
      const networkRequestId = openNetworkSearchInSplit({
        networkErrorMessage: null,
        networkIsLoading: true,
        networkQueryChunk: null,
        networkResults: [],
      });

      try {
        const result = await searchCursorNetwork({
          cursorIndex: selectionStart,
          memoId: activeMemoId,
          text,
        });
        updateNetworkSearchSplit(networkRequestId, {
          networkErrorMessage:
            result.message && result.results.length === 0
              ? result.message
              : null,
          networkIsLoading: false,
          networkQueryChunk: result.queryChunk,
          networkResults: result.results,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '네트워크 검색에 실패했습니다.';
        updateNetworkSearchSplit(networkRequestId, {
          networkErrorMessage: message.includes('login')
            ? '기기 연동 로그인 후 온라인 네트워크를 사용할 수 있습니다.'
            : '온라인 네트워크 검색을 사용할 수 없습니다. backend URL과 연결 상태를 확인해 주세요.',
          networkIsLoading: false,
          networkQueryChunk: null,
          networkResults: [],
        });
      }
      return;
    }

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
        error instanceof Error
          ? error.message
          : '네트워크 검색에 실패했습니다.';
      setNetworkErrorMessage(
        message.includes('login')
          ? '기기 연동 로그인 후 온라인 네트워크를 사용할 수 있습니다.'
          : '온라인 네트워크 검색을 사용할 수 없습니다. backend URL과 연결 상태를 확인해 주세요.',
      );
    } finally {
      setNetworkLoading(false);
    }
  }, [
    activeMemoId,
    isSplitWorkspaceEnabled,
    openNetworkSearchInSplit,
    selectionStart,
    text,
    updateNetworkSearchSplit,
  ]);

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
      lastScheduleSelectionRef.current = null;
      showScheduleRegisteredAlert(trimmed);
    },
    [addScheduleFromSelection, selectionStart, showScheduleRegisteredAlert],
  );

  const handleScheduleSelection = useCallback(() => {
    const fallback = lastScheduleSelectionRef.current;
    const scheduleText = selectedText || fallback?.text || '';
    const selectedMatch =
      parseDates(scheduleText, Date.now())[0] ??
      selectedDateMatch ??
      fallback?.match;

    if (scheduleText && selectedMatch) {
      registerSelectedTextSchedule(scheduleText, selectedMatch.date.getTime());
      return;
    }

    setPendingScheduleText(scheduleText);
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

      const fallbackText = lastScheduleSelectionRef.current?.text ?? '';
      const scheduleText = pendingScheduleText || selectedText || fallbackText;

      if (scheduleText) {
        registerSelectedTextSchedule(
          scheduleText,
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

  const shouldShowSidebar = isMac || !isPhone || isSidebarOpen;
  const shouldShowEditor = isMac || !isPhone || !isSidebarOpen;

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
                accessibilityLabel="목록"
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
              <Text
                numberOfLines={1}
                style={[styles.title, isMac && styles.titleMacos]}
              >
                {editorTitle}
              </Text>
              {!isPhone && !isMac && (
                <Text style={styles.subtitle}>
                  날짜를 감지한 뒤 선택해서 일정으로 등록합니다
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            {isSplitWorkspaceEnabled && (
              <>
                <Pressable
                  accessibilityLabel="분할 보기 추가"
                  accessibilityState={{ disabled: !canAddSplitPane }}
                  hitSlop={6}
                  onPress={handleAddSplitPane}
                  style={({ pressed }) => [
                    styles.iconButton,
                    hasSplitPanes && styles.iconButtonActive,
                    !canAddSplitPane && styles.iconButtonDisabled,
                    pressed && canAddSplitPane && styles.controlPressed,
                  ]}
                >
                  <Columns2 size={18} color="#5C4D3C" />
                </Pressable>
              </>
            )}
            {!(isPhone && isSidebarOpen) && (
              <Pressable
                accessibilityLabel="옵션"
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
              accessibilityLabel="새 노트"
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

        {isSplitWorkspaceEnabled && shouldShowEditor && <MarkdownToolbar />}

        <View style={styles.body}>
          {shouldShowSidebar && (
            <MemoSidebar
              activeCategoryFilter={activeCategoryFilter}
              activeMemoId={activeMemoId}
              isDraftingNewMemo={isDraftingNewMemo}
              isPhone={isPhone}
              onClearCategoryFilter={handleClearCategoryFilter}
              onSelectCategory={handleSelectCategory}
              onSelectDraft={handleSelectDraft}
              onSelectMemo={handleSelectMemo}
              openMemoPanelNumbers={openMemoPanelNumbers}
              viewMode={sidebarViewMode}
              onChangeViewMode={handleChangeSidebarViewMode}
            />
          )}

          {shouldShowEditor && (
            <View style={styles.editorWorkspace}>
              <View style={styles.editorWorkspaceContent}>
                {isSplitWorkspaceEnabled ? (
                  <View style={styles.splitWorkspaceHostFull}>
                    <MemoSplitWorkspace
                      activeMemoId={activeMemoId}
                      focusedPaneId={focusedPaneId}
                      onChangePane={handleChangeSplitPane}
                      onClosePane={handleCloseSplitPane}
                      onFocusPane={setFocusedPaneId}
                      onOpenResult={openAmbientResultInSplit}
                      onSelectCategory={handleSelectCategory}
                      panes={splitPanes}
                    />
                  </View>
                ) : (
                  <View style={styles.mainEditorPane}>
                    <MemoEditor
                      highlightedPieces={highlightedPieces}
                      inputAccessoryViewID={
                        Platform.OS === 'ios'
                          ? DATE_ACTIONS_ACCESSORY_ID
                          : undefined
                      }
                      onChangeText={handleChangeText}
                      onScheduleSelection={handleScheduleSelection}
                      onSelectionChange={(start, end) => {
                        setSelectionStart(start);
                        setSelectionEnd(end);
                      }}
                      onAmbientIdle={handleAmbientIdle}
                      selectedText={selectedText}
                      text={text}
                    />
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {isAmbientVisible &&
          ambientQueryChunk &&
          ambientResults.length > 0 &&
          !isNetworkVisible &&
          shouldShowEditor && (
            <View
              pointerEvents="box-none"
              style={[
                styles.ambientCardLayer,
                isPhone && styles.ambientCardLayerPhone,
              ]}
            >
              <View
                style={[
                  styles.ambientCardsRow,
                  isPhone && styles.ambientCardsColumn,
                  ambientResults.length === 1 && styles.ambientCardsSingle,
                ]}
              >
                {ambientResults.map(result => (
                  <AmbientNetworkCard
                    compact
                    key={`${result.sourceKind}:${result.chunkId}`}
                    onPress={() => {
                      setSelectedAmbientResult(result);
                      setAmbientVisible(false);
                      if (isSplitWorkspaceEnabled) {
                        setAmbientPreviewVisible(true);
                        return;
                      }

                      setAmbientDetailVisible(true);
                    }}
                    queryChunk={ambientQueryChunk}
                    result={result}
                  />
                ))}
              </View>
            </View>
          )}

        {isAmbientPreviewVisible &&
          selectedAmbientResult &&
          shouldShowEditor &&
          isSplitWorkspaceEnabled && (
            <View pointerEvents="box-none" style={styles.ambientPreviewLayer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openAmbientResultInSplit(selectedAmbientResult)}
                style={({ pressed }) => [
                  styles.ambientPreviewCard,
                  pressed && styles.controlPressed,
                ]}
              >
                <View style={styles.ambientPreviewHeader}>
                  <Text style={styles.ambientPreviewLabel}>
                    {selectedAmbientResult.sourceKind === 'memo'
                      ? '유사한 생각'
                      : selectedAmbientResult.sourceLabel ?? '저장한 링크'}
                  </Text>
                  <Pressable
                    accessibilityLabel="유사 생각 미리보기 닫기"
                    hitSlop={8}
                    onPress={event => {
                      event.stopPropagation();
                      setAmbientPreviewVisible(false);
                    }}
                    style={styles.ambientPreviewClose}
                  >
                    <Text style={styles.ambientPreviewCloseText}>×</Text>
                  </Pressable>
                </View>
                <Text numberOfLines={4} style={styles.ambientPreviewText}>
                  {selectedAmbientResult.chunkText}
                </Text>
                <Text style={styles.ambientPreviewHint}>
                  한 번 더 누르면 오른쪽 split에서 엽니다
                </Text>
              </Pressable>
            </View>
          )}
      </KeyboardAvoidingView>

      {isMoreMenuVisible && (
        <>
          <Pressable
            accessibilityLabel="옵션 닫기"
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
                {activeMemo?.pinned ? '고정 해제' : '핀 고정'}
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
                노트 삭제
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={DATE_ACTIONS_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <DateQuickActions
              focusedDateLabel={focusedDateLabel}
              onDismissFocusedDate={handleDismissFocusedDate}
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
              focusedDateLabel={focusedDateLabel}
              onDismissFocusedDate={handleDismissFocusedDate}
              onDismissKeyboard={Keyboard.dismiss}
              onInsertToken={insertToken}
              onOpenCalendar={() => setDateModalVisible(true)}
            />
          </View>
        )
      )}

      {Platform.OS === 'macos' &&
        !isSplitWorkspaceEnabled &&
        focusedDateLabel &&
        shouldShowEditor && (
        <View pointerEvents="box-none" style={styles.dateDetectionFloating}>
          <View style={styles.dateDetectionBar}>
            <Text numberOfLines={1} style={styles.dateDetectionText}>
              {focusedDateLabel}
            </Text>
            <Pressable
              accessibilityLabel="감지된 날짜 닫기"
              hitSlop={8}
              onPress={handleDismissFocusedDate}
              style={({ pressed }) => [
                styles.dateDetectionClose,
                pressed && styles.controlPressed,
              ]}
              focusable={false}
              // @ts-ignore
              enableFocusRing={false}
            >
              <Text style={styles.dateDetectionCloseText}>×</Text>
            </Pressable>
          </View>
        </View>
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
        onOpenSourceUrl={url => {
          Linking.openURL(url).catch(() => undefined);
        }}
        queryChunk={ambientQueryChunk}
        result={selectedAmbientResult}
        visible={isAmbientDetailVisible}
      />
    </SafeAreaView>
  );
};

const editorTextBase = {
  ...(editorFontFamily ? { fontFamily: editorFontFamily } : {}),
  fontSize: 15,
  lineHeight: EDITOR_LINE_HEIGHT,
  paddingHorizontal: 4,
  paddingTop: 28,
} as const;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F4F0',
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  titleMacos: {
    fontSize: 24,
    letterSpacing: -0.2,
    maxWidth: 360,
  },
  subtitle: {
    color: '#9C9283',
    fontSize: 12,
    marginTop: 3,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  pinButton: {
    alignItems: 'center',
    backgroundColor: '#FCFAF7',
    borderColor: '#E6E1DA',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    marginRight: 8,
    minHeight: 36,
    paddingHorizontal: 13,
    paddingVertical: 8,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  pinButtonActive: {
    backgroundColor: '#8B7355',
    borderColor: '#8B7355',
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
    color: '#FCFAF7',
  },
  pinButtonTextDisabled: {
    color: '#9C9283',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#FCFAF7',
    borderColor: '#E6E1DA',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    width: 36,
  },
  iconButtonActive: {
    backgroundColor: '#EBE5D9',
  },
  sidebarToggleIconOpen: {
    transform: [{ rotate: '180deg' }],
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
  editorWorkspace: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    flexDirection: 'column',
  },
  editorWorkspaceContent: {
    flex: 1,
    flexDirection: 'row',
  },
  mainEditorPane: {
    flex: 1,
    minWidth: 0,
  },
  splitWorkspaceHost: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  splitWorkspaceHostFull: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  ambientCardLayer: {
    bottom: 26,
    left: 18,
    position: 'absolute',
    right: 18,
    zIndex: 60,
  },
  ambientCardLayerPhone: {
    bottom: 16,
    left: 12,
    right: 12,
  },
  ambientCardsRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    maxWidth: 520,
    width: '100%',
  },
  ambientCardsColumn: {
    flexDirection: 'column',
    gap: 8,
    maxWidth: 360,
  },
  ambientCardsSingle: {
    maxWidth: 320,
  },
  ambientPreviewLayer: {
    bottom: 26,
    left: 18,
    position: 'absolute',
    right: 18,
    zIndex: 70,
  },
  ambientPreviewCard: {
    alignSelf: 'center',
    backgroundColor: '#FCFAF7',
    borderColor: '#E1D8CA',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 380,
    padding: 12,
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    width: '100%',
  },
  ambientPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ambientPreviewLabel: {
    color: '#8B7355',
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  ambientPreviewClose: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    marginLeft: 8,
    width: 22,
  },
  ambientPreviewCloseText: {
    color: '#786B5F',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  ambientPreviewText: {
    color: '#2C2520',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  ambientPreviewHint: {
    color: '#A09180',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
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
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '800',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
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
    fontWeight: '600',
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  selectionFloatingText: {
    color: '#FAF6F0',
    fontSize: 12,
    fontWeight: '700',
  },
  dateDetectionFloating: {
    bottom: 18,
    left: 18,
    position: 'absolute',
    right: 18,
    zIndex: 95,
  },
  dateDetectionBar: {
    alignItems: 'center',
    backgroundColor: '#EAF6ED',
    borderColor: '#BBDDC5',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 34,
    paddingLeft: 12,
    paddingRight: 5,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  dateDetectionText: {
    color: '#236B45',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  dateDetectionClose: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 7,
    width: 26,
  },
  dateDetectionCloseText: {
    color: '#236B45',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
