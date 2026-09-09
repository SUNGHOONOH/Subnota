import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { format } from 'date-fns';
import type { Editor } from '@tiptap/core';
import { formatRelativeDay } from '../../../lib/relativeDay';
import {
  type AppShortcutSettings,
  formatHotkeyHint,
} from '../../../lib/shortcutSettings';
import {
  CalendarDays,
  Network,
} from '@/components/icons';
import { useClickOutside } from '@mantine/hooks';
import TooltipIconButton from '../../../components/TooltipIconButton';
import RenderErrorBoundary from '../../../components/RenderErrorBoundary';
import {
  CalendarBlockDraft,
  CalendarCategoryDraft,
  CalendarCategoryRow,
  MemoRow,
  MemoSaveState,
  CalendarBlockRow,
  MemoSimilarityEdge,
  ScheduleInboxRow,
  TopicCluster,
  TopicInboxMembership,
  TopicMemoInboxEdge,
  TopicMembership,
} from '../../../types';
import { resolveMemoSavePresentation } from '../../../lib/memoSaveStatus';
import { InboxSession } from '../../../services/backend/inboxService';
import { isMeaningfulChunk, MemoChunk } from '../../../lib/memoChunker';
import type { AmbientSearchTarget } from '../../../lib/ambientSearch';
import {
  NetworkSearchResult,
} from '../../../services/local/memoSearchTypes';
import {
  type AmbientGhost,
  type AmbientIdleAnchor,
  NoteFixedToolbar,
  SimpleEditor,
} from '../../../components/tiptap-templates/simple/simple-editor';
import {
  editorsAfterCloseTab,
  editorsAfterOpenSource,
  editorsAfterOpenTab,
} from '../../../lib/splitPaneTabs';
import {
  formatDisplayDate,
  formatTimeIfPresent,
} from '../../../lib/dateParser';
import { joinNoteContent, splitNoteContent } from '../../../lib/noteTitle';
import {
  buildScheduleFromSelection,
  buildScheduleNote,
  didScheduleConfirmSelectionChange,
} from '../../../lib/scheduleFromSelection';
import MemoSplitScheduleOverlay, {
  type MemoSplitScheduleConfirmState,
} from './MemoSplitScheduleOverlay';
import RelatedSentenceCard from './RelatedSentenceCard';
import MemoSplitPaneHeader from './MemoSplitPaneHeader';
import MemoSplitNoteMenu from './MemoSplitNoteMenu';
import MemoSplitSpecialView from './MemoSplitSpecialView';
import SplitWorkspaceCommandBar from './SplitWorkspaceCommandBar';
import { useSplitPaneResize } from '../useSplitPaneResize';
import { useNearbyNotesSearch } from '../useNearbyNotesSearch';
import {
  EDITOR_TAB_DRAG_TYPE,
  getActiveEditor,
  getPaneEditors,
  inboxSessionToSourceResult,
  memoToPreviewResult,
  mirrorEditorPatch,
  TabDropTarget,
  createEditor,
} from '../memoSplitWorkspaceUtils';
import { localize, useUiLanguage } from '../../../lib/uiLanguage';

export type MemoSplitPaneView =
  | 'memo'
  | 'inbox'
  | 'calendar'
  | 'briefing'
  | 'network'
  | 'topics'
  | 'source';

export interface MemoSplitEditorState {
  ambientQueryText?: string;
  draftCategory?: string;
  draftText?: string;
  highlight?: {
    chunkText?: string;
    endIndex: number;
    startIndex: number;
  } | null;
  id: string;
  isViewPicker?: boolean;
  memoId?: string;
  mode?: 'draft' | 'existing';
  networkErrorMessage?: string | null;
  networkIsLoading?: boolean;
  networkQueryChunk?: MemoChunk | null;
  networkRequestId?: string;
  networkResults?: NetworkSearchResult[];
  selectionEnd?: number;
  selectionStart?: number;
  selectedText?: string;
  sourceResult?: NetworkSearchResult;
  view: MemoSplitPaneView;
}

export interface MemoSplitPaneState extends MemoSplitEditorState {
  activeEditorId?: string;
  editors?: MemoSplitEditorState[];
}

// network·source는 네트워크 검색·웹 요약 열기의 결과로만 열리는 뷰라
// 사용자가 직접 고르는 목록에서는 제외한다.
const PaneBodyRenderer = ({ render }: { render: () => React.ReactNode }) => (
  <>{render()}</>
);

interface MemoSplitWorkspaceProps {
  ambientEditorId?: string | null;
  ambientEmptyEditorId?: string | null;
  ambientError?: string | null;
  ambientPendingEditorId?: string | null;
  ambientResult?: NetworkSearchResult | null;
  onMemoEditorBlur?: (memoId: string) => void;
  onRunAmbientSearch?: (target?: AmbientSearchTarget) => void;
  canAddPane?: boolean;
  focusedPaneId?: string | null;
  initialPaneWidths?: Record<string, number>;
  isSessionCollapsed?: boolean;
  onToggleSession?: () => void;
  onOpenGlobalSearch?: () => void;
  onAddPane?: () => void;
  onChangePane: (id: string, patch: Partial<MemoSplitPaneState>) => void;
  onMoveEditor: (
    sourcePaneId: string,
    targetPaneId: string,
    editorId: string,
    targetIndex: number,
  ) => void;
  onCloseAllPanes?: () => void;
  onClosePane?: (id: string) => void;
  onFocusPane?: (id: string) => void;
  onPaneWidthsChange?: (widths: Record<string, number>) => void;
  onAmbientQuery?: (
    editorId: string,
    memoId: string | null,
    queryText: string,
  ) => void;
  onDismissAmbient?: (editorId: string) => void;
  // 고스트 줄의 단축키 힌트에 쓴다. 사용자가 재바인딩하면 힌트도 따라간다.
  appShortcuts?: AppShortcutSettings;
  searchShortcut?: string;
  // 참조 성격의 열기(ambient 추천, 주변메모·Topics 그래프, 캘린더 원본 노트)는
  // 새 탭 대신 미리보기 패널로 보낸다. 원본과 비교하려고 여는 것이라
  // 새 탭으로 열면 보고 있던 것이 화면에서 사라지기 때문이다.
  onOpenPreview?: (
    results: NetworkSearchResult[],
    mode?: 'detail' | 'list',
    options?: {
      promotionTooltip?: string;
      showMoreResults?: boolean;
    },
  ) => void;
  panes: MemoSplitPaneState[];
  memos: MemoRow[];
  memoSaveStates?: Readonly<Record<string, MemoSaveState>>;
  onCreateMemo: (content: string, category?: string) => MemoRow;
  onDeleteMemoById?: (memoId: string) => void;
  onRetryMemoSync?: (memoId: string) => void;
  onUpdateMemo: (
    id: string,
    content: string,
    previousEditorContent?: string,
  ) => void;
  retryingMemoIds?: string[];
  onSelectMemoById: (memoId: string) => void;

  // 캘린더 연동
  calendarBlocks: CalendarBlockRow[];
  calendarCategories: CalendarCategoryRow[];
  onCreateCalendarCategory: (
    draft: CalendarCategoryDraft,
  ) => Promise<CalendarCategoryRow | null>;
  onDeleteCalendarCategory: (categoryId: string) => Promise<boolean>;
  onDeleteCalendarBlock: (id: string) => void;
  onSaveCalendarBlock: (draft: CalendarBlockDraft) => Promise<boolean>;
  onToggleCalendarBlockCompleted: (id: string) => void;
  isScheduleInboxPanelOpen?: boolean;
  hasNewReport?: boolean;
  onDropScheduleInbox?: (itemId: string, startDate: Date) => void;
  onToggleScheduleInboxPanel?: () => void;
  onOpenReport?: () => void;

  // 수집함 연동
  inboxItems: InboxSession[];
  isInboxLoading: boolean;
  onDeleteInboxItem: (id: string) => void;
  onRetryInboxSummary: (item: InboxSession) => Promise<void>;
  onSaveInboxUrl: (url: string) => Promise<unknown>;
  onToggleInboxLike: (id: string, liked: boolean) => void;

  // 브리핑 연동
  scheduleInbox: ScheduleInboxRow[];
  scheduleSuggestions: ScheduleInboxRow[];
  onDeleteScheduleInbox: (item: ScheduleInboxRow) => void;
  onPlaceScheduleInbox: (item: ScheduleInboxRow) => void;
  onPlaceScheduleSuggestion: (
    item: ScheduleInboxRow,
    overrides: {
      allDay: boolean;
      note: string | null;
      startDate: Date;
      title: string;
    },
  ) => void;

  // Topics 지도 데이터
  folderSourceTopicIds?: string[];
  isTopicsLoading?: boolean;
  onCreateFolderFromTopic?: (draft: {
    description?: string;
    mode: 'automatic' | 'manual';
    name: string;
    topicId: string;
  }) => Promise<unknown>;
  onRegenerateTopics?: () => Promise<void>;
  topicClusters: TopicCluster[];
  topicUpdatedAt?: string | null;
  topicInboxEdges?: TopicMemoInboxEdge[];
  topicInboxMemberships?: TopicInboxMembership[];
  topicGlobalEdges: MemoSimilarityEdge[];
  topicMemberships: TopicMembership[];

  // 메모 고정
  onTogglePinMemo?: (memoId: string) => void;
  pinnedMemoIds?: string[];
}

const MemoSplitWorkspace = ({
  ambientEditorId = null,
  ambientEmptyEditorId = null,
  ambientError = null,
  ambientPendingEditorId = null,
  ambientResult = null,
  onMemoEditorBlur,
  onRunAmbientSearch,
  canAddPane = true,
  focusedPaneId,
  initialPaneWidths = {},
  isSessionCollapsed = false,
  onToggleSession,
  onOpenGlobalSearch,
  onAddPane,
  onChangePane,
  onMoveEditor,
  onCloseAllPanes,
  onClosePane,
  onFocusPane,
  onPaneWidthsChange,
  onAmbientQuery,
  onDismissAmbient,
  panes,
  memos,
  memoSaveStates = {},
  appShortcuts,
  searchShortcut,
  onCreateMemo,
  onDeleteMemoById,
  onRetryMemoSync,
  onOpenPreview,
  onUpdateMemo,
  onSelectMemoById,
  retryingMemoIds = [],
  calendarBlocks,
  calendarCategories,
  onCreateCalendarCategory,
  onDeleteCalendarCategory,
  onDeleteCalendarBlock,
  onSaveCalendarBlock,
  onToggleCalendarBlockCompleted,
  isScheduleInboxPanelOpen = false,
  hasNewReport = false,
  onDropScheduleInbox,
  onToggleScheduleInboxPanel,
  onOpenReport,
  inboxItems,
  isInboxLoading,
  onDeleteInboxItem,
  onRetryInboxSummary,
  onSaveInboxUrl,
  onToggleInboxLike,
  scheduleInbox,
  scheduleSuggestions,
  onDeleteScheduleInbox,
  onPlaceScheduleInbox,
  onPlaceScheduleSuggestion,
  folderSourceTopicIds = [],
  isTopicsLoading = false,
  onCreateFolderFromTopic,
  onRegenerateTopics,
  topicClusters,
  topicUpdatedAt = null,
  topicInboxEdges = [],
  topicInboxMemberships = [],
  topicGlobalEdges,
  topicMemberships,
  onTogglePinMemo,
  pinnedMemoIds = [],
}: MemoSplitWorkspaceProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [insertTextRequests, setInsertTextRequests] = useState<
    Record<string, { id: string; text: string }>
  >({});
  const [openDatePickerEditorId, setOpenDatePickerEditorId] = useState<
    string | null
  >(null);
  // 피커를 "날짜 변경"으로 열 때 감지된 날짜를 시드로 넘긴다.
  const [datePickerSeed, setDatePickerSeed] = useState<Date | null>(null);
  // 날짜가 감지됐을 때 바로 저장하지 않고 보여주는 확인 팝오버 상태.
  const [scheduleConfirm, setScheduleConfirm] =
    useState<MemoSplitScheduleConfirmState | null>(null);
  const [openMenuPaneId, setOpenMenuPaneId] = useState<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<{
    editorId: string;
    paneId: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<TabDropTarget | null>(null);
  // 스택 탭 드롭다운 외부 클릭 시 닫기. 토글 버튼이 있는 actions 줄은 제외해
  // "닫힘 → onClick 재오픈" 레이스를 막는다 (한 번에 하나만 열리므로 ref 한 쌍).
  const [menuDropdownEl, setMenuDropdownEl] = useState<HTMLDivElement | null>(
    null,
  );
  const [menuActionsEl, setMenuActionsEl] = useState<HTMLDivElement | null>(
    null,
  );
  useClickOutside(() => setOpenMenuPaneId(null), null, [
    menuDropdownEl,
    menuActionsEl,
  ]);
  // 노트 ⋯ 메뉴(노트 관리 전용). 패널 메뉴와 동일한 외부 클릭 닫기 패턴.
  const [openNoteMenuEditorId, setOpenNoteMenuEditorId] = useState<
    string | null
  >(null);
  const [noteMenuFeedback, setNoteMenuFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [noteMenuDropdownEl, setNoteMenuDropdownEl] =
    useState<HTMLDivElement | null>(null);
  const [noteMenuButtonEl, setNoteMenuButtonEl] =
    useState<HTMLDivElement | null>(null);
  useClickOutside(() => setOpenNoteMenuEditorId(null), null, [
    noteMenuDropdownEl,
    noteMenuButtonEl,
  ]);
  const [editorInstances, setEditorInstances] = useState<
    Record<string, Editor | null>
  >({});
  const [ambientAnchors, setAmbientAnchors] = useState<
    Record<string, AmbientIdleAnchor>
  >({});
  const draftMemoIdsRef = useRef<Map<string, string>>(new Map());
  // Enter로 빈 블록을 만든 직후에는 직전 블록을 다시 검색하지 않는다.
  // 새 텍스트가 입력되어 질의가 달라지면 자동으로 해제된다.
  const ambientSuppressedQueriesRef = useRef<Record<string, string>>({});
  const [paneWidths, setPaneWidths] = useState<Record<string, number>>(
    () => initialPaneWidths,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panesRef = useRef(panes);
  const paneIdsRef = useRef(panes.map((pane) => pane.id).join('|'));
  const draggedTabRef = useRef<{ editorId: string; paneId: string } | null>(
    null,
  );

  useEffect(() => {
    panesRef.current = panes;
  }, [panes]);

  useEffect(() => {
    const paneIds = panes.map((pane) => pane.id).join('|');
    if (paneIdsRef.current === paneIds) {
      return;
    }

    paneIdsRef.current = paneIds;
    const equalWidth = panes.length > 0 ? 100 / panes.length : 100;
    const nextWidths = Object.fromEntries(
      panes.map((pane) => [pane.id, equalWidth]),
    );
    setPaneWidths(nextWidths);
    onPaneWidthsChange?.(nextWidths);
  }, [onPaneWidthsChange, panes]);

  const memoById = useMemo(() => {
    return new Map(memos.map((memo) => [memo.id, memo]));
  }, [memos]);

  const focusedPane = useMemo(
    () => panes.find((pane) => pane.id === focusedPaneId) ?? panes[0] ?? null,
    [focusedPaneId, panes],
  );
  const focusedEditor = focusedPane ? getActiveEditor(focusedPane) : null;

  // Never hand the toolbar a destroyed Tiptap instance — a stale id left in
  // editorInstances after a pane/editor is closed would otherwise crash the
  // whole renderer (white screen) when the toolbar reads it.
  const resolveLiveEditor = (id?: string | null) => {
    if (!id) {
      return null;
    }
    const instance = editorInstances[id];
    return instance && !instance.isDestroyed ? instance : null;
  };

  // 크롬 줄 undo/redo가 바라보는 에디터. 노트 탭이 아닐 때는 null을 넘겨
  // 파괴된 Tiptap 인스턴스를 잡는 destroy/render 레이스를 피한다.
  const focusedToolbarEditor =
    focusedEditor?.view === 'memo' ? resolveLiveEditor(focusedPane?.id) : null;

  // Editor instances are keyed by PANE id (each pane renders exactly one live
  // SimpleEditor, for its active editor). Keying by editor.id was fragile: when
  // the active editor.id changed without the Tiptap instance remounting, the
  // toolbar lookup missed and the markdown toolbar vanished. Drop instances for
  // panes that no longer exist.
  useEffect(() => {
    const livePaneIds = new Set(panes.map((pane) => pane.id));
    const liveEditorIds = new Set(
      panes.flatMap((pane) => getPaneEditors(pane).map((editor) => editor.id)),
    );
    for (const editorId of draftMemoIdsRef.current.keys()) {
      if (!liveEditorIds.has(editorId)) {
        draftMemoIdsRef.current.delete(editorId);
      }
    }
    setEditorInstances((prev) => {
      const entries = Object.entries(prev).filter(([id]) =>
        livePaneIds.has(id),
      );
      return entries.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(entries);
    });
  }, [panes]);

  const patchActiveEditor = useCallback(
    (pane: MemoSplitPaneState, patch: Partial<MemoSplitEditorState>) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);
      const nextActiveEditor: MemoSplitEditorState = {
        ...activeEditor,
        ...patch,
      };
      const nextEditors = editors.map((editor) =>
        editor.id === activeEditor.id ? nextActiveEditor : editor,
      );

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextActiveEditor),
        activeEditorId: nextActiveEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const upsertEditorById = useCallback(
    (
      paneId: string,
      editor: MemoSplitEditorState,
      patch: Partial<MemoSplitEditorState>,
      activate: boolean,
    ) => {
      const pane = panesRef.current.find(
        (candidate) => candidate.id === paneId,
      );
      if (!pane) {
        return;
      }

      const editors = getPaneEditors(pane);
      const nextEditor: MemoSplitEditorState = { ...editor, ...patch };
      const hasEditor = editors.some((candidate) => candidate.id === editor.id);
      const nextEditors = hasEditor
        ? editors.map((candidate) =>
            candidate.id === editor.id ? nextEditor : candidate,
          )
        : [...editors, nextEditor];
      const activeEditorId = activate
        ? nextEditor.id
        : (pane.activeEditorId ?? nextEditor.id);
      const nextActiveEditor =
        nextEditors.find((candidate) => candidate.id === activeEditorId) ??
        nextEditor;

      onChangePane(paneId, {
        ...mirrorEditorPatch(nextActiveEditor),
        activeEditorId: nextActiveEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const { runEditorStateBSearch } = useNearbyNotesSearch({
    inboxItems,
    memoById,
    memos,
    panes,
    t,
    upsertEditorById,
  });

  const handleAddEditor = useCallback(
    (pane: MemoSplitPaneState) => {
      const editors = getPaneEditors(pane);
      const nextEditor = createEditor('memo', { isViewPicker: true });

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: [...editors, nextEditor],
      });
      onFocusPane?.(pane.id);
    },
    [onChangePane, onFocusPane],
  );

  const handleSelectEditorView = useCallback(
    (pane: MemoSplitPaneState, view: MemoSplitPaneView) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);
      const nextEditor: MemoSplitEditorState = {
        ...activeEditor,
        isViewPicker: false,
        mode:
          view === 'memo' ? (activeEditor.mode ?? 'draft') : activeEditor.mode,
        view,
      };
      const nextEditors = editors.map((editor) =>
        editor.id === activeEditor.id ? nextEditor : editor,
      );

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: nextEditors,
      });
      setOpenMenuPaneId(null);
    },
    [onChangePane],
  );

  const handleCloseAllEditors = useCallback(
    (pane: MemoSplitPaneState) => {
      const nextEditor = createEditor('memo', { isViewPicker: true });

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: [nextEditor],
      });
      setOpenMenuPaneId(null);
    },
    [onChangePane],
  );

  const handleCloseEditor = useCallback(
    (pane: MemoSplitPaneState, editorId: string) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);

      if (editors.length <= 1) {
        // 마지막 탭을 닫으면 빈 노트를 만들지 않고 패널 자체를 닫는다.
        if (onClosePane) {
          onClosePane(pane.id);
          return;
        }

        const nextEditor = createEditor('memo', { isViewPicker: true });
        onChangePane(pane.id, {
          ...mirrorEditorPatch(nextEditor),
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
        });
        return;
      }

      const { activeEditor: nextEditor, editors: nextEditors } =
        editorsAfterCloseTab(editors, activeEditor.id, editorId);

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane, onClosePane],
  );

  const clearTabDrag = useCallback(() => {
    draggedTabRef.current = null;
    setDraggedTab(null);
    setDropTarget(null);
  }, []);

  const handleTabDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      paneId: string,
      editorId: string,
    ) => {
      const nextDraggedTab = { editorId, paneId };
      draggedTabRef.current = nextDraggedTab;
      setDraggedTab(nextDraggedTab);
      event.dataTransfer.setData(EDITOR_TAB_DRAG_TYPE, editorId);
      event.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleTabDragOver = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      paneId: string,
      target: Omit<TabDropTarget, 'paneId'> = { position: 'after' },
    ) => {
      if (
        !draggedTabRef.current ||
        !Array.from(event.dataTransfer.types).includes(EDITOR_TAB_DRAG_TYPE)
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTarget({ paneId, ...target });
    },
    [],
  );

  const handleTabDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        event.currentTarget.contains(nextTarget)
      ) {
        return;
      }
      setDropTarget(null);
    },
    [],
  );

  const handleTabDrop = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      targetPaneId: string,
      targetIndex: number,
    ) => {
      if (
        !draggedTabRef.current ||
        !Array.from(event.dataTransfer.types).includes(EDITOR_TAB_DRAG_TYPE)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const sourcePaneId = draggedTabRef.current.paneId;
      const editorId = draggedTabRef.current.editorId;
      const sourcePane = panes.find((pane) => pane.id === sourcePaneId);
      const movedEditor = sourcePane
        ? getPaneEditors(sourcePane).find((editor) => editor.id === editorId)
        : undefined;

      onMoveEditor(sourcePaneId, targetPaneId, editorId, targetIndex);
      if (sourcePaneId !== targetPaneId) {
        onFocusPane?.(targetPaneId);
        if (movedEditor?.memoId) {
          onSelectMemoById(movedEditor.memoId);
        }
      }
      clearTabDrag();
    },
    [clearTabDrag, onFocusPane, onMoveEditor, onSelectMemoById, panes],
  );

  const beginResizePane = useSplitPaneResize({
    containerRef,
    onPaneWidthsChange,
    paneWidths,
    panes,
    setPaneWidths,
  });

  const openMemoInPane = useCallback(
    (paneId: string, memo: MemoRow) => {
      const pane = panes.find((candidate) => candidate.id === paneId);
      const nextEditors = pane ? getPaneEditors(pane) : [];

      onSelectMemoById(memo.id);

      // Already open in this pane → focus that tab instead of a duplicate.
      const existingEditor = nextEditors.find(
        (editor) => editor.view === 'memo' && editor.memoId === memo.id,
      );
      if (existingEditor) {
        onChangePane(paneId, {
          ...mirrorEditorPatch(existingEditor),
          activeEditorId: existingEditor.id,
          editors: nextEditors,
        });
        return;
      }

      const nextEditor = createEditor('memo', {
        highlight: null,
        memoId: memo.id,
        mode: 'existing',
      });
      onChangePane(paneId, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: editorsAfterOpenTab(
          nextEditors,
          pane ? getActiveEditor(pane).id : undefined,
          nextEditor,
        ),
      });
    },
    [onChangePane, onSelectMemoById, panes],
  );

  const openSourceInPane = useCallback(
    (pane: MemoSplitPaneState, result: NetworkSearchResult) => {
      // 패널에서 명시적으로 승격한 경우에만 탭으로 열고, 같은 수집 항목이
      // 이미 열려 있으면 그 탭을 포커스한다.
      const { activeEditor, editors } = editorsAfterOpenSource(
        getPaneEditors(pane),
        createEditor('source', { sourceResult: result }),
      );
      onChangePane(pane.id, {
        ...mirrorEditorPatch(activeEditor),
        activeEditorId: activeEditor.id,
        editors,
      });
    },
    [onChangePane],
  );

  // 미리보기 패널의 "새 탭으로 열기"는 target:'beside'를 실어 보낸다.
  // 패널이 2개면 포커스되지 않은 쪽에 열어야 쓰던 초안이 화면에 남는다.
  const resolveOpenTargetPane = useCallback(
    (target?: 'beside' | 'focused') => {
      if (target === 'beside' && panes.length > 1) {
        return panes.find((pane) => pane.id !== focusedPane?.id) ?? panes[0];
      }
      return focusedPane ?? panes[0];
    },
    [focusedPane, panes],
  );

  // 목록·검색·토픽 폴더의 링크 클릭 → 기본적으로 우측 미리보기에서 연다.
  useEffect(() => {
    const handleOpenInboxSource = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          inboxSessionId?: string;
          target?: 'beside' | 'focused';
        }>
      ).detail;
      const item = inboxItems.find(
        (candidate) => candidate.id === detail?.inboxSessionId,
      );
      const pane = resolveOpenTargetPane(detail?.target);
      if (!item) {
        return;
      }

      const result = inboxSessionToSourceResult(item);
      if (detail?.target && pane) {
        // 미리보기 패널의 "새 탭으로 열기" 승격 경로만 탭을 만든다.
        openSourceInPane(pane, result);
      } else {
        // 목록·검색·토픽 폴더에서 참고로 연 웹 요약은 현재 작업을
        // 가리지 않도록 공통 우측 미리보기 패널에서 보여준다.
        onOpenPreview?.([result]);
      }
    };

    window.addEventListener('subnota:open-inbox-source', handleOpenInboxSource);
    return () =>
      window.removeEventListener(
        'subnota:open-inbox-source',
        handleOpenInboxSource,
      );
  }, [inboxItems, onOpenPreview, openSourceInPane, resolveOpenTargetPane]);

  // 캘린더 일정의 "원본 노트 열기" → 캘린더를 보면서 출처를 확인하는
  // 흐름이라 참조다. 탭으로 열면 캘린더가 사라져 확인의 의미가 없어진다.
  // (승격용 subnota:open-memo와 의도가 달라 이벤트를 분리해 둔다.)
  useEffect(() => {
    const handlePreviewMemo = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string }>).detail;
      const memo = detail?.memoId ? memoById.get(detail.memoId) : null;
      if (memo) {
        onOpenPreview?.([memoToPreviewResult(memo)]);
      }
    };

    window.addEventListener('subnota:preview-memo', handlePreviewMemo);
    return () =>
      window.removeEventListener('subnota:preview-memo', handlePreviewMemo);
  }, [memoById, onOpenPreview]);

  // 미리보기 패널의 "새 탭으로 열기" 승격 경로.
  useEffect(() => {
    const handleOpenMemo = (event: Event) => {
      const detail = (
        event as CustomEvent<{ memoId?: string; target?: 'beside' | 'focused' }>
      ).detail;
      const memo = detail?.memoId ? memoById.get(detail.memoId) : null;
      const pane = resolveOpenTargetPane(detail?.target);
      if (memo && pane) {
        openMemoInPane(pane.id, memo);
      }
    };

    window.addEventListener('subnota:open-memo', handleOpenMemo);
    return () =>
      window.removeEventListener('subnota:open-memo', handleOpenMemo);
  }, [memoById, openMemoInPane, resolveOpenTargetPane]);

  const handleChangeMemoText = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
    nextText: string,
    previousEditorText?: string,
  ) => {
    if (editor.memoId) {
      draftMemoIdsRef.current.delete(editor.id);
      onUpdateMemo(editor.memoId, nextText, previousEditorText);
      if (editor.highlight) {
        patchActiveEditor(pane, { highlight: null });
      }
      return;
    }

    const claimedMemoId = draftMemoIdsRef.current.get(editor.id);
    if (claimedMemoId) {
      onUpdateMemo(claimedMemoId, nextText, previousEditorText);
      return;
    }

    if (!nextText.trim()) {
      patchActiveEditor(pane, { draftText: nextText, mode: 'draft' });
      return;
    }

    const createdMemo = onCreateMemo(nextText, editor.draftCategory);
    // Tiptap은 한 사용자 동작에서 여러 update transaction을 낼 수 있다.
    // React pane 상태가 반영되기 전에도 같은 draft는 즉시 같은 메모를 소유한다.
    draftMemoIdsRef.current.set(editor.id, createdMemo.id);
    onSelectMemoById(createdMemo.id);
    patchActiveEditor(pane, {
      draftText: undefined,
      highlight: null,
      memoId: createdMemo.id,
      mode: 'existing',
    });
  };

  const insertDateToken = (editorId: string, token: string) => {
    setInsertTextRequests((previous) => ({
      ...previous,
      [editorId]: {
        id: `split-date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: `${token} `,
      },
    }));
  };

  const clearInsertTextRequest = (editorId: string, requestId: string) => {
    setInsertTextRequests((previous) => {
      if (previous[editorId]?.id !== requestId) {
        return previous;
      }
      const next = { ...previous };
      delete next[editorId];
      return next;
    });
  };

  const registerEditorSchedule = (
    editor: MemoSplitEditorState,
    anchor: { left: number; top: number; width: number },
  ) => {
    const selectedText = editor.selectedText?.trim() ?? '';

    if (!selectedText) {
      window.alert(
        t(
          '일정으로 등록할 문장을 먼저 선택하세요.',
          'Select the sentence you want to add to your calendar first.',
        ),
      );
      return;
    }

    // 기준일은 의도적으로 Date.now()(buildScheduleFromSelection 기본값) — created_at을
    // 쓰면 오래된 메모에 오늘 새로 쓴 상대 날짜("내일" 등)가 과거로 어긋난다. 등록
    // 시점 재해석에 따른 드리프트는 확인 바가 확정 절대 날짜를 미리 보여줘 사용자가
    // 잡는다. (작성 시점 freeze는 마크다운 저장 구조상 비용이 커 보류.)
    const schedule = buildScheduleFromSelection(selectedText, Date.now(), language);
    if (!schedule.date) {
      // 날짜 미인식 → 바로 날짜 피커를 띄워 직접 고르게 한다.
      setScheduleConfirm(null);
      setDatePickerSeed(null);
      setOpenDatePickerEditorId(editor.id);
      return;
    }

    // 날짜 감지 → 저장 전에 감지 결과(숫자 날짜)를 확인 바로 보여준다.
    const time = formatTimeIfPresent(schedule.date, language);
    const label = time
      ? `${formatDisplayDate(schedule.date, language)} ${time}`
      : formatDisplayDate(schedule.date, language);
    setOpenDatePickerEditorId(null);
    setScheduleConfirm({
      anchor,
      editorId: editor.id,
      date: schedule.date,
      allDay: schedule.allDay,
      title: schedule.title,
      label,
      selectionEnd: editor.selectionEnd ?? 0,
      selectionStart: editor.selectionStart ?? 0,
    });
  };

  const commitScheduleConfirm = (editor: MemoSplitEditorState) => {
    if (!scheduleConfirm) {
      return;
    }
    const selectedText = editor.selectedText?.trim() ?? '';
    void onSaveCalendarBlock({
      allDay: scheduleConfirm.allDay,
      color: '#66705A',
      note: buildScheduleNote(selectedText, editor.memoId),
      startDate: scheduleConfirm.date.toISOString(),
      title: scheduleConfirm.title,
    }).then((saved) => {
      if (saved) window.alert(t('일정이 등록되었습니다.', 'Added to calendar.'));
    });
    setScheduleConfirm(null);
  };

  const openPickerFromConfirm = (editor: MemoSplitEditorState) => {
    if (!scheduleConfirm) {
      return;
    }
    // scheduleConfirm은 유지한다 — 피커를 닫으면 확인 바로 되돌아오도록.
    setDatePickerSeed(scheduleConfirm.date);
    setOpenDatePickerEditorId(editor.id);
  };

  const applyEditorDate = (
    editor: MemoSplitEditorState,
    date: Date,
    allDay: boolean,
  ) => {
    const selectedText = editor.selectedText?.trim() ?? '';

    if (selectedText) {
      void onSaveCalendarBlock({
        allDay,
        color: '#66705A',
        note: buildScheduleNote(selectedText, editor.memoId),
        startDate: date.toISOString(),
        title: buildScheduleFromSelection(selectedText, Date.now(), language).title,
      }).then((saved) => {
        if (saved) window.alert(t('일정이 등록되었습니다.', 'Added to calendar.'));
      });
    } else {
      insertDateToken(
        editor.id,
        format(date, allDay ? 'yy.MM.dd' : 'yy.MM.dd HH:mm'),
      );
    }
    setOpenDatePickerEditorId(null);
    setDatePickerSeed(null);
    setScheduleConfirm(null);
  };

  const renderPaneBody = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
  ) => {
    if (editor.isViewPicker || editor.view !== 'memo') {
      return (
        <MemoSplitSpecialView
          calendar={{
            blocks: calendarBlocks,
            categories: calendarCategories,
            hasNewReport,
            isScheduleInboxOpen: isScheduleInboxPanelOpen,
            onCreateCategory: onCreateCalendarCategory,
            onDeleteBlock: onDeleteCalendarBlock,
            onDeleteCategory: onDeleteCalendarCategory,
            onDeleteScheduleSuggestion: onDeleteScheduleInbox,
            onDropScheduleInbox,
            onOpenReport,
            onPlaceScheduleSuggestion,
            onSaveBlock: onSaveCalendarBlock,
            onToggleCompleted: onToggleCalendarBlockCompleted,
            onToggleScheduleInbox: onToggleScheduleInboxPanel,
            scheduleSuggestions,
          }}
          editor={editor}
          inbox={{
            inboxItems,
            isLoading: isInboxLoading,
            onDelete: onDeleteInboxItem,
            onOpenDetail: (item) =>
              onOpenPreview?.([inboxSessionToSourceResult(item)]),
            onSaveUrl: onSaveInboxUrl,
            onToggleLike: onToggleInboxLike,
          }}
          language={language}
          nearby={{
            errorMessage: editor.networkErrorMessage,
            isLoading: editor.networkIsLoading,
            language,
            memos,
            onOpenResult: (result) => {
              if (result.memoId) {
                onSelectMemoById(result.memoId);
              }
              onOpenPreview?.([result], 'detail', {});
            },
            onRetry: () => void runEditorStateBSearch(pane, editor),
            queryChunk: editor.networkQueryChunk,
            results: editor.networkResults,
          }}
          onSelectView={handleSelectEditorView}
          pane={pane}
          scheduleInbox={{
            inboxItems: scheduleInbox,
            onDeleteInbox: onDeleteScheduleInbox,
            onPlaceInbox: onPlaceScheduleInbox,
          }}
          source={{
            inboxItems,
            language,
            onRetryInboxSummary,
            result: editor.sourceResult,
            t,
          }}
          topics={{
            activeMemoId: editor.memoId,
            folderSourceTopicIds,
            inboxItems,
            isTopicsLoading,
            memos,
            onCreateFolderFromTopic,
            onOpenMemo: (memo) => openMemoInPane(pane.id, memo),
            onOpenPreview,
            onRegenerateTopics,
            onSelectMemoById,
            topicClusters,
            topicGlobalEdges,
            topicInboxEdges,
            topicInboxMemberships,
            topicMemberships,
            topicUpdatedAt,
          }}
        />
      );
    }

    const memo = editor.memoId ? (memoById.get(editor.memoId) ?? null) : null;
    const value =
      editor.mode === 'existing'
        ? (editor.draftText ?? memo?.content ?? '')
        : (editor.draftText ?? '');
    const savePresentation = memo
      ? resolveMemoSavePresentation(memo, memoSaveStates[memo.id])
      : null;
    // 자동 저장의 정상 진행·완료는 사용자가 요청한 일이 아니므로 헤더를
    // 계속 흔들지 않는다. 실제로 조치가 필요한 실패만 제목 행에 알린다.
    const showSaveIssue = Boolean(
      memo &&
        (memoSaveStates[memo.id] === 'local-failed' ||
          memo.local_sync_status === 'failed'),
    );
    const isMemoSyncRetrying = Boolean(
      memo && retryingMemoIds.includes(memo.id),
    );
    // 제목 = content 첫 줄(기존 파생 규칙). 본문 에디터에는 첫 줄을 제외한
    // 나머지만 넣고, 저장은 항상 join된 전체 content로 기존 경로를 탄다.
    const { body: noteBody, title: noteTitle } = splitNoteContent(value);
    const isNoteMenuOpen = openNoteMenuEditorId === editor.id;
    const liveEditor = resolveLiveEditor(pane.id);
    const dismissAmbientForEditor = (suppressCurrentQuery = true) => {
      const queryText = editor.ambientQueryText;
      if (suppressCurrentQuery && queryText) {
        ambientSuppressedQueriesRef.current[editor.id] = queryText;
      } else {
        delete ambientSuppressedQueriesRef.current[editor.id];
      }
      setAmbientAnchors((previous) => {
        if (!previous[editor.id]) return previous;
        const next = { ...previous };
        delete next[editor.id];
        return next;
      });
      onDismissAmbient?.(editor.id);
    };
    const ambientAnchor = ambientAnchors[editor.id];
    // 글을 쓰던 중에 흘끗 보는 것이므로 참조다. 새 탭으로 열면 쓰던
    // 초안이 화면에서 사라져 추천을 확인하는 의미가 없어진다.
    const openAmbientResult = (result: NetworkSearchResult) => {
      onOpenPreview?.([result], 'detail', {
        promotionTooltip: t('새 메모 탭으로 열기', 'Open in a new note tab'),
        showMoreResults: true,
      });
    };
    const ambientGhost: AmbientGhost | null =
      pane.id === focusedPane?.id &&
      editor.id === ambientEditorId &&
      ambientResult &&
      ambientAnchor
        ? {
            from: ambientAnchor.from,
            to: ambientAnchor.to,
            key: ambientResult.chunkId,
            meta:
              ambientResult.sourceKind === 'inbox'
                ? t('저장한 링크', 'Saved link')
                : formatRelativeDay(
                    ambientResult.memoCreatedAt ?? ambientResult.createdAt,
                    undefined,
                    language,
                  ) || t('연결된 문장', 'Related sentence'),
            text: ambientResult.chunkText,
            hint: formatHotkeyHint(appShortcuts?.openAmbientDetail),
            onClick: () => openAmbientResult(ambientResult),
          }
        : null;
    const selectedAmbientText =
      editor.selectedText?.trim().slice(0, 1000) ?? '';
    const manualAmbientTarget = isMeaningfulChunk(selectedAmbientText)
      ? {
          editorId: editor.id,
          memoId: editor.memoId ?? null,
          queryText: selectedAmbientText,
        }
      : null;
    const runManualAmbientSearch = () => {
      if (!manualAmbientTarget) return;
      if (
        liveEditor ||
        editor.selectionStart !== undefined ||
        editor.selectionEnd !== undefined
      ) {
        const from = editor.selectionStart ?? liveEditor?.state.selection.from;
        const to = editor.selectionEnd ?? liveEditor?.state.selection.to;
        if (from !== undefined && to !== undefined) {
          setAmbientAnchors((previous) => ({
            ...previous,
            [editor.id]: { from, to },
          }));
        }
      }
      patchActiveEditor(pane, {
        ambientQueryText: manualAmbientTarget.queryText,
      });
      onRunAmbientSearch?.(manualAmbientTarget);
    };

    return (
      <div
        className="split-memo-pane-body"
        onBlurCapture={(event: React.FocusEvent<HTMLDivElement>) => {
          const nextTarget = event.relatedTarget;
          if (
            nextTarget instanceof Node &&
            event.currentTarget.contains(nextTarget)
          ) {
            return;
          }
          if (editor.memoId) {
            onMemoEditorBlur?.(editor.memoId);
          }
        }}
        >
        <div className="split-note-header">
          <div className="split-note-title-row">
            <input
              aria-label={t('노트 제목', 'Note title')}
              className="split-note-title-input"
              onChange={(event) =>
                handleChangeMemoText(
                  pane,
                  editor,
                  joinNoteContent(event.target.value, noteBody),
                  value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  resolveLiveEditor(pane.id)?.chain().focus('start').run();
                }
              }}
              placeholder={t('제목 없음', 'Untitled note')}
              spellCheck={false}
              type="text"
              value={noteTitle}
            />
            {showSaveIssue && (
              <span
                aria-label={savePresentation?.label}
                className="split-note-save-status"
                role="status"
                title={savePresentation?.label}
              >
                !
              </span>
            )}
            <MemoSplitNoteMenu
              editor={editor}
              isMemoSyncRetrying={isMemoSyncRetrying}
              isNoteMenuOpen={isNoteMenuOpen}
              memo={memo}
              noteMenuFeedback={noteMenuFeedback}
              noteTitle={noteTitle}
              onClearFeedback={() => setNoteMenuFeedback(null)}
              onCloseEditor={handleCloseEditor}
              onCloseMenu={() => setOpenNoteMenuEditorId(null)}
              onCreateMemo={onCreateMemo}
              onDeleteMemoById={onDeleteMemoById}
              onOpenMemoInPane={openMemoInPane}
              onRetryMemoSync={onRetryMemoSync}
              onSetFeedback={setNoteMenuFeedback}
              onSetMenuButtonElement={setNoteMenuButtonEl}
              onSetMenuDropdownElement={setNoteMenuDropdownEl}
              onToggleMenu={() =>
                setOpenNoteMenuEditorId((current) =>
                  current === editor.id ? null : editor.id,
                )
              }
              onTogglePinMemo={onTogglePinMemo}
              pane={pane}
              pinnedMemoIds={pinnedMemoIds}
              savePresentation={savePresentation}
              translate={t}
              value={value}
            />
          </div>
          <NoteFixedToolbar editor={liveEditor}>
            <TooltipIconButton
              className="split-action-btn note-tool-btn"
              onClick={() => {
                setScheduleConfirm(null);
                setDatePickerSeed(null);
                setOpenDatePickerEditorId((current) =>
                  current === editor.id ? null : editor.id,
                );
              }}
              tooltip={t('날짜 선택', 'Choose date')}
            >
              <CalendarDays size={15} />
            </TooltipIconButton>
            <TooltipIconButton
              className="split-action-btn note-tool-btn"
              onClick={() => void runEditorStateBSearch(pane, editor)}
              tooltip={t('주변 메모', 'Nearby notes')}
            >
              <Network size={15} />
            </TooltipIconButton>
          </NoteFixedToolbar>
          <MemoSplitScheduleOverlay
            confirmLabel={t('등록', 'Add')}
            datePickerSeed={datePickerSeed}
            editor={editor}
            onApplyDate={applyEditorDate}
            onChangeDate={openPickerFromConfirm}
            onCloseConfirm={() => setScheduleConfirm(null)}
            onCloseDatePicker={() => {
              // 피커만 닫는다 — scheduleConfirm이 있으면 확인 바로 복귀.
              setOpenDatePickerEditorId(null);
              setDatePickerSeed(null);
            }}
            onConfirm={commitScheduleConfirm}
            openDatePickerEditorId={openDatePickerEditorId}
            scheduleConfirm={scheduleConfirm}
          />
        </div>
        <RelatedSentenceCard
          highlight={editor.highlight}
          language={language}
          onClose={() => patchActiveEditor(pane, { highlight: null })}
          value={value}
        />
        <SimpleEditor
          key={editor.id}
          ambientGhost={ambientGhost}
          hideToolbar
          insertTextRequest={insertTextRequests[editor.id] ?? null}
          onAmbientDismiss={dismissAmbientForEditor}
          onAmbientIdle={(queryText, anchor) => {
            const suppressedQuery =
              ambientSuppressedQueriesRef.current[editor.id];
            if (suppressedQuery === queryText) {
              delete ambientSuppressedQueriesRef.current[editor.id];
              return;
            }
            if (suppressedQuery) {
              delete ambientSuppressedQueriesRef.current[editor.id];
            }
            if (anchor) {
              setAmbientAnchors((previous) => ({
                ...previous,
                [editor.id]: anchor,
              }));
            }
            patchActiveEditor(pane, { ambientQueryText: queryText });
            onAmbientQuery?.(editor.id, editor.memoId ?? null, queryText);
          }}
          onEditorFocus={() => {
            onFocusPane?.(pane.id);
            if (editor.memoId) {
              onSelectMemoById(editor.memoId);
            }
          }}
          onEditorReady={(instance) => {
            setEditorInstances((previous) => ({
              ...previous,
              [pane.id]: instance,
            }));
          }}
          onInsertTextRequestHandled={(requestId) =>
            clearInsertTextRequest(editor.id, requestId)
          }
          onSearchSelection={
            manualAmbientTarget ? runManualAmbientSearch : undefined
          }
          onRegisterSchedule={(anchor) =>
            registerEditorSchedule(editor, anchor)
          }
          value={noteBody}
          onChange={(nextBody: string, previousBody: string) => {
            dismissAmbientForEditor(false);
            handleChangeMemoText(
              pane,
              editor,
              joinNoteContent(noteTitle, nextBody),
              joinNoteContent(noteTitle, previousBody),
            );
          }}
          onSelectionChange={(
            selectedText: string,
            from: number,
            to: number,
          ) => {
            if (
              scheduleConfirm?.editorId === editor.id &&
              didScheduleConfirmSelectionChange(
                scheduleConfirm.selectionStart,
                scheduleConfirm.selectionEnd,
                from,
                to,
              )
            ) {
              setScheduleConfirm(null);
            }
            patchActiveEditor(pane, {
              selectionEnd: to,
              selectionStart: from,
              selectedText: selectedText.trim(),
            });
            const anchor = ambientAnchors[editor.id];
            const ambientIsPending =
              editor.id === ambientPendingEditorId ||
              editor.id === ambientEditorId;
            if (
              anchor &&
              ambientIsPending &&
              (from !== anchor.from || to !== anchor.to)
            ) {
              dismissAmbientForEditor(false);
            }
          }}
          autoFocus={false}
          showVersionLabel={false}
        />
        {pane.id === focusedPane?.id && editor.id === ambientEmptyEditorId && (
          <div className="ambient-editor-status" role="status">
            {t('유사한 문장이 없습니다', 'No similar sentence found')}
          </div>
        )}
        {pane.id === focusedPane?.id &&
          editor.id === ambientEditorId &&
          ambientError && (
            <div
              className="ambient-editor-status ambient-editor-status-error ambient-inline-error"
              role="status"
            >
              <span>{ambientError}</span>
              <button onClick={runManualAmbientSearch} type="button">
                {t('다시 시도', 'Try again')}
              </button>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="split-workspace-shell">
      <SplitWorkspaceCommandBar
        appShortcuts={appShortcuts}
        focusedToolbarEditor={focusedToolbarEditor}
        isSessionCollapsed={isSessionCollapsed}
        language={language}
        onOpenGlobalSearch={onOpenGlobalSearch}
        onToggleSession={onToggleSession}
        searchShortcut={searchShortcut}
      />
      <div
        className={`split-workspace-container${isSessionCollapsed ? ' session-collapsed' : ''}`}
        ref={containerRef}
      >
        {panes.map((pane) => {
          const editors = getPaneEditors(pane);
          const activeEditor = getActiveEditor(pane);
          const isMenuOpen = openMenuPaneId === pane.id;
          const paneIndex = panes.findIndex(
            (candidate) => candidate.id === pane.id,
          );
          const defaultWidth = 100 / Math.max(panes.length, 1);

          return (
            <React.Fragment key={pane.id}>
              <div
                className={`split-pane ${focusedPaneId === pane.id ? 'focused' : ''}`}
                onMouseDown={() => onFocusPane?.(pane.id)}
                style={{
                  flexBasis: `${paneWidths[pane.id] ?? defaultWidth}%`,
                }}
              >
                <MemoSplitPaneHeader
                  appShortcuts={appShortcuts}
                  canAddPane={canAddPane}
                  draggedTab={draggedTab}
                  dropTarget={dropTarget}
                  editors={editors}
                  isLastPane={panes.length <= 1}
                  isMenuOpen={isMenuOpen}
                  language={language}
                  memoById={memoById}
                  onAddEditor={handleAddEditor}
                  onAddPane={onAddPane}
                  onChangePane={onChangePane}
                  onClearTabDrag={clearTabDrag}
                  onCloseAllEditors={handleCloseAllEditors}
                  onCloseEditor={handleCloseEditor}
                  onClosePane={(targetPane) =>
                    onClosePane
                      ? onClosePane(targetPane.id)
                      : onCloseAllPanes?.()
                  }
                  onFocusPane={onFocusPane}
                  onHandleTabDragLeave={handleTabDragLeave}
                  onHandleTabDragOver={handleTabDragOver}
                  onHandleTabDrop={handleTabDrop}
                  onHandleTabDragStart={handleTabDragStart}
                  onSelectEditorView={handleSelectEditorView}
                  onSelectMemoById={onSelectMemoById}
                  onSetMenuActionsElement={setMenuActionsEl}
                  onSetMenuDropdownElement={setMenuDropdownEl}
                  onToggleMenu={() =>
                    setOpenMenuPaneId((current) =>
                      current === pane.id ? null : pane.id,
                    )
                  }
                  pane={pane}
                  translate={t}
                />
                <div className="split-pane-body-wrapper">
                  <RenderErrorBoundary
                    fallback={() => (
                      <div className="split-pane-render-error" role="alert">
                        <strong>{t('이 탭을 표시하지 못했습니다.', 'Could not display this tab.')}</strong>
                        <button
                          onClick={() => handleCloseAllEditors(pane)}
                          type="button"
                        >
                          {t('노트 탭으로 초기화', 'Reset to a note tab')}
                        </button>
                      </div>
                    )}
                    resetKey={`${pane.id}:${activeEditor.id}:${activeEditor.view}:${activeEditor.isViewPicker ? 'picker' : 'view'}`}
                  >
                    <PaneBodyRenderer
                      render={() => renderPaneBody(pane, activeEditor)}
                    />
                  </RenderErrorBoundary>
                </div>
              </div>
              {paneIndex < panes.length - 1 && (
                <div
                  aria-hidden
                  className="split-pane-resizer"
                  onPointerDown={(event) =>
                    beginResizePane(event, pane.id, panes[paneIndex + 1].id)
                  }
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default MemoSplitWorkspace;
