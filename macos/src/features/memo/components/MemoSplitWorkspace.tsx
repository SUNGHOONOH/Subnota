import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { format } from 'date-fns';
import type { Editor } from '@tiptap/core';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Columns2,
  Network,
  PanelLeft,
  Plus,
  X,
} from '@/components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import { MemoRow, CalendarBlockRow, BriefingRow, ScheduleInboxRow, TopicCluster, TopicMembership } from '../../../types';
import { getCursorChunkWindow, MemoChunk } from '../../../lib/memoChunker';
import { NetworkSearchResult, searchCursorNetwork } from '../../../services/backend/networkService';
import {
  SimpleEditor,
  SimpleEditorToolbar,
} from '../../../components/tiptap-templates/simple/simple-editor';
import CalendarWorkspace from '../../calendar/CalendarWorkspace';
import BriefingWorkspace from '../../briefing/BriefingWorkspace';
import InboxWorkspace from '../../inbox/InboxWorkspace';
import { getMemoCategory } from '../../../lib/memoCategory';
import { parseDates } from '../../../lib/dateParser';
import DateSchedulePopover from './DateSchedulePopover';
import KnowledgeGraphView, {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './KnowledgeGraphView';

export type MemoSplitPaneView =
  | 'memo'
  | 'inbox'
  | 'calendar'
  | 'briefing'
  | 'network'
  | 'source';

export interface MemoSplitEditorState {
  draftCategory?: string;
  draftText?: string;
  highlight?: {
    chunkText?: string;
    endIndex: number;
    startIndex: number;
  } | null;
  id: string;
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

const VIEW_LABELS: Record<MemoSplitPaneView, string> = {
  briefing: '브리핑',
  calendar: '캘린더',
  inbox: '수집함',
  memo: '노트',
  network: '무의식',
  source: '링크',
};

const MENU_VIEWS: MemoSplitPaneView[] = [
  'memo',
  'inbox',
  'calendar',
  'briefing',
  'network',
];

const createEditorId = () =>
  `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEditor = (
  view: MemoSplitPaneView = 'memo',
  patch: Partial<MemoSplitEditorState> = {},
): MemoSplitEditorState => ({
  id: createEditorId(),
  mode: view === 'memo' ? 'draft' : undefined,
  view,
  ...patch,
});

const paneToEditor = (pane: MemoSplitPaneState): MemoSplitEditorState => ({
  draftCategory: pane.draftCategory,
  draftText: pane.draftText,
  highlight: pane.highlight,
  id: pane.activeEditorId ?? `${pane.id}-editor`,
  memoId: pane.memoId,
  mode: pane.mode,
  networkErrorMessage: pane.networkErrorMessage,
  networkIsLoading: pane.networkIsLoading,
  networkQueryChunk: pane.networkQueryChunk,
  networkRequestId: pane.networkRequestId,
  networkResults: pane.networkResults,
  selectionEnd: pane.selectionEnd,
  selectionStart: pane.selectionStart,
  selectedText: pane.selectedText,
  sourceResult: pane.sourceResult,
  view: pane.view,
});

const getPaneEditors = (pane: MemoSplitPaneState) => {
  return pane.editors && pane.editors.length > 0
    ? pane.editors
    : [paneToEditor(pane)];
};

const getActiveEditor = (pane: MemoSplitPaneState) => {
  const editors = getPaneEditors(pane);
  return (
    editors.find(editor => editor.id === pane.activeEditorId) ?? editors[0]
  );
};

const mirrorEditorPatch = (
  editor: MemoSplitEditorState,
): Partial<MemoSplitPaneState> => ({
  draftCategory: editor.draftCategory,
  draftText: editor.draftText,
  highlight: editor.highlight,
  memoId: editor.memoId,
  mode: editor.mode,
  networkErrorMessage: editor.networkErrorMessage,
  networkIsLoading: editor.networkIsLoading,
  networkQueryChunk: editor.networkQueryChunk,
  networkRequestId: editor.networkRequestId,
  networkResults: editor.networkResults,
  selectionEnd: editor.selectionEnd,
  selectionStart: editor.selectionStart,
  selectedText: editor.selectedText,
  sourceResult: editor.sourceResult,
  view: editor.view,
});

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const buildSplitKnnGraph = (results: NetworkSearchResult[]) => {
  const nodes: KnowledgeGraphNode[] = [
    {
      color: '#5c4d3c',
      id: 'network:query',
      label: '지금 문장',
      size: 13,
      x: 0,
      y: 0,
    },
  ];
  const edges: KnowledgeGraphEdge[] = [];
  const total = Math.max(results.length, 1);

  results.forEach((result, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const similarity = clamp(result.similarity, 0, 1);
    const distance = 1.05 - similarity * 0.45;
    const nodeId = `network:${result.chunkId}`;

    nodes.push({
      color: result.sourceKind === 'inbox' ? '#6d7185' : '#7f8a6f',
      id: nodeId,
      label: `${Math.round(similarity * 100)}%`,
      size: clamp(5 + similarity * 9, 6, 14),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    });
    edges.push({
      id: `network-edge-${result.chunkId}`,
      source: 'network:query',
      target: nodeId,
      weight: similarity,
    });
  });

  return { edges, nodes };
};

const buildSplitTopicGraph = (
  clusters: TopicCluster[],
  memberships: TopicMembership[],
  activeMemoId: string | null,
) => {
  const nodes: KnowledgeGraphNode[] = [
    {
      color: '#8b7355',
      id: 'topic-root',
      label: 'Topics',
      size: 10,
      x: 0,
      y: 0,
    },
  ];
  const edges: KnowledgeGraphEdge[] = [];
  const total = Math.max(clusters.length, 1);

  clusters.forEach((cluster, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const topicMemberships = memberships.filter(item => item.topicId === cluster.id);
    const isActiveLinked = Boolean(
      activeMemoId && topicMemberships.some(item => item.memoId === activeMemoId),
    );
    const count = Math.max(cluster.memoCount, topicMemberships.length, isActiveLinked ? 1 : 0);
    const nodeId = `topic:${cluster.id}`;

    nodes.push({
      color: isActiveLinked ? '#236b45' : '#5c4d3c',
      id: nodeId,
      label: cluster.label,
      size: clamp(6 + count * 0.75 + (cluster.confidence ?? 0) * 4, 7, 16),
      x: Math.cos(angle),
      y: Math.sin(angle),
    });
    edges.push({
      id: `topic-root-${cluster.id}`,
      source: 'topic-root',
      target: nodeId,
      weight: isActiveLinked ? 1 : clamp((cluster.confidence ?? 0.45), 0.25, 0.9),
    });
  });

  return { edges, nodes };
};

const getSourceLabel = (result: NetworkSearchResult) => {
  if (result.sourceKind === 'memo') {
    return '노트';
  }
  if (result.sourceLabel) {
    return result.sourceLabel;
  }
  return '웹페이지';
};

interface MemoSplitWorkspaceProps {
  canAddPane?: boolean;
  focusedPaneId?: string | null;
  initialPaneWidths?: Record<string, number>;
  isSessionCollapsed?: boolean;
  onToggleSession?: () => void;
  onAddPane?: () => void;
  onChangePane: (id: string, patch: Partial<MemoSplitPaneState>) => void;
  onCloseAllPanes?: () => void;
  onClosePane?: (id: string) => void;
  onFocusPane?: (id: string) => void;
  onPaneWidthsChange?: (widths: Record<string, number>) => void;
  panes: MemoSplitPaneState[];
  memos: MemoRow[];
  onCreateMemo: (content: string, category?: string) => MemoRow;
  onUpdateMemo: (id: string, content: string) => void;
  onSelectMemoById: (memoId: string) => void;
  
  // 캘린더 연동
  calendarBlocks: CalendarBlockRow[];
  onDeleteCalendarBlock: (id: string) => void;
  onSaveCalendarBlock: (draft: any) => Promise<void>;

  // 수집함 연동
  inboxItems: any[];
  isInboxLoading: boolean;
  onRefreshInbox: () => void;
  onSaveInboxUrl: (url: string) => Promise<void>;

  // 브리핑 연동
  briefings: BriefingRow[];
  scheduleInbox: ScheduleInboxRow[];
  onAcceptInbox: (item: ScheduleInboxRow) => void;
  onDismissInbox: (item: ScheduleInboxRow) => void;

  // 무의식 토픽 지도 데이터
  topicClusters: TopicCluster[];
  topicMemberships: TopicMembership[];
}

const MemoSplitWorkspace = ({
  canAddPane = true,
  focusedPaneId,
  initialPaneWidths = {},
  isSessionCollapsed = false,
  onToggleSession,
  onAddPane,
  onChangePane,
  onCloseAllPanes,
  onClosePane,
  onFocusPane,
  onPaneWidthsChange,
  panes,
  memos,
  onCreateMemo,
  onUpdateMemo,
  onSelectMemoById,
  calendarBlocks,
  onDeleteCalendarBlock,
  onSaveCalendarBlock,
  inboxItems,
  isInboxLoading,
  onRefreshInbox,
  onSaveInboxUrl,
  briefings,
  scheduleInbox,
  onAcceptInbox,
  onDismissInbox,
  topicClusters,
  topicMemberships,
}: MemoSplitWorkspaceProps) => {
  const [insertTextRequests, setInsertTextRequests] = useState<
    Record<string, { id: string; text: string }>
  >({});
  const [openDatePickerEditorId, setOpenDatePickerEditorId] = useState<
    string | null
  >(null);
  const [openMenuPaneId, setOpenMenuPaneId] = useState<string | null>(null);
  const [activeEditorInstanceId, setActiveEditorInstanceId] = useState<string | null>(
    null,
  );
  const [editorInstances, setEditorInstances] = useState<
    Record<string, Editor | null>
  >({});
  const [paneWidths, setPaneWidths] = useState<Record<string, number>>(
    () => initialPaneWidths,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paneIdsRef = useRef(panes.map(pane => pane.id).join('|'));

  useEffect(() => {
    const paneIds = panes.map(pane => pane.id).join('|');
    if (paneIdsRef.current === paneIds) {
      return;
    }

    paneIdsRef.current = paneIds;
    const equalWidth = panes.length > 0 ? 100 / panes.length : 100;
    const nextWidths = Object.fromEntries(
      panes.map(pane => [pane.id, equalWidth]),
    );
    setPaneWidths(nextWidths);
    onPaneWidthsChange?.(nextWidths);
  }, [onPaneWidthsChange, panes]);

  const memoById = useMemo(() => {
    return new Map(memos.map(memo => [memo.id, memo]));
  }, [memos]);

  const focusedPane = useMemo(
    () =>
      panes.find(pane => pane.id === focusedPaneId) ??
      panes[0] ??
      null,
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
  // Safety net: if neither id resolves (e.g. an id changed out from under the
  // map), fall back to any live instance so the toolbar never vanishes.
  const firstLiveEditor = () => {
    for (const candidate of Object.values(editorInstances)) {
      if (candidate && !candidate.isDestroyed) {
        return candidate;
      }
    }
    return null;
  };
  // The live editor for the focused pane (null when the focused pane shows a
  // non-editor view like calendar/inbox). Drives whether the toolbar is active.
  const focusedToolbarEditor =
    resolveLiveEditor(focusedPane?.id) ?? resolveLiveEditor(activeEditorInstanceId);
  // Always hand the toolbar SOME live instance so the buttons render; when the
  // focused pane has no editor we keep them rendered but disabled (greyed),
  // rather than letting the whole toolbar vanish.
  const activeToolbarEditor = focusedToolbarEditor ?? firstLiveEditor();
  const isToolbarActive = Boolean(focusedToolbarEditor);

  // Editor instances are keyed by PANE id (each pane renders exactly one live
  // SimpleEditor, for its active editor). Keying by editor.id was fragile: when
  // the active editor.id changed without the Tiptap instance remounting, the
  // toolbar lookup missed and the markdown toolbar vanished. Drop instances for
  // panes that no longer exist.
  useEffect(() => {
    const livePaneIds = new Set(panes.map(pane => pane.id));
    setEditorInstances(prev => {
      const entries = Object.entries(prev).filter(([id]) => livePaneIds.has(id));
      return entries.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(entries);
    });
    setActiveEditorInstanceId(prev =>
      prev && livePaneIds.has(prev) ? prev : null,
    );
  }, [panes]);

  const patchActiveEditor = useCallback(
    (pane: MemoSplitPaneState, patch: Partial<MemoSplitEditorState>) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);
      const nextActiveEditor: MemoSplitEditorState = {
        ...activeEditor,
        ...patch,
      };
      const nextEditors = editors.map(editor =>
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

  const patchEditorById = useCallback(
    (
      pane: MemoSplitPaneState,
      editorId: string,
      patch: Partial<MemoSplitEditorState>,
    ) => {
      const editors = getPaneEditors(pane);
      const nextEditors = editors.map(editor =>
        editor.id === editorId ? { ...editor, ...patch } : editor,
      );
      const nextActiveEditor =
        nextEditors.find(editor => editor.id === pane.activeEditorId) ??
        nextEditors.find(editor => editor.id === editorId) ??
        nextEditors[0];

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextActiveEditor),
        activeEditorId: nextActiveEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const getEditorText = useCallback(
    (editor: MemoSplitEditorState) => {
      if (editor.view !== 'memo') {
        return '';
      }
      const memo = editor.memoId ? memoById.get(editor.memoId) ?? null : null;
      return editor.mode === 'existing'
        ? editor.draftText ?? memo?.content ?? ''
        : editor.draftText ?? '';
    },
    [memoById],
  );

  const runEditorNetworkSearch = useCallback(
    async (pane: MemoSplitPaneState, editor: MemoSplitEditorState) => {
      const text = getEditorText(editor);
      if (!text.trim()) {
        return;
      }

      const cursorIndex = editor.selectionStart ?? 0;
      const queryChunk = getCursorChunkWindow(text, cursorIndex, 0).center;
      const networkRequestId = `network-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      patchEditorById(pane, editor.id, {
        networkErrorMessage: null,
        networkIsLoading: true,
        networkQueryChunk: queryChunk,
        networkRequestId,
        networkResults: [],
        view: 'network',
      });

      try {
        const response = await searchCursorNetwork({
          cursorIndex,
          limit: 8,
          memoId: editor.memoId ?? null,
          text,
        });

        patchEditorById(pane, editor.id, {
          networkErrorMessage: response.message ?? null,
          networkIsLoading: false,
          networkQueryChunk: response.queryChunk,
          networkRequestId,
          networkResults: response.results,
          view: 'network',
        });
      } catch (error) {
        patchEditorById(pane, editor.id, {
          networkErrorMessage:
            error instanceof Error ? error.message : '네트워크 검색에 실패했습니다.',
          networkIsLoading: false,
          networkRequestId,
          networkResults: [],
          view: 'network',
        });
      }
    },
    [getEditorText, patchEditorById],
  );

  const handleAddEditor = useCallback(
    (pane: MemoSplitPaneState, view: MemoSplitPaneView = 'memo') => {
      const editors = getPaneEditors(pane);
      const nextEditor = createEditor(view);

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: [...editors, nextEditor],
      });
    },
    [onChangePane],
  );

  const handleSelectEditorView = useCallback(
    (pane: MemoSplitPaneState, view: MemoSplitPaneView) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);
      const nextEditor: MemoSplitEditorState = {
        ...activeEditor,
        mode: view === 'memo' ? activeEditor.mode ?? 'draft' : activeEditor.mode,
        view,
      };
      const nextEditors = editors.map(editor =>
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
      const nextEditor = createEditor('memo');

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
        const nextEditor = createEditor('memo');
        onChangePane(pane.id, {
          ...mirrorEditorPatch(nextEditor),
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
        });
        return;
      }

      const closingIndex = editors.findIndex(editor => editor.id === editorId);
      const nextEditors = editors.filter(editor => editor.id !== editorId);
      const nextEditor =
        activeEditor.id === editorId
          ? nextEditors[
              Math.max(0, Math.min(closingIndex, nextEditors.length - 1))
            ]
          : activeEditor;

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const beginResizePane = (
    event: React.MouseEvent<HTMLDivElement>,
    leftPaneId: string,
    rightPaneId: string,
  ) => {
    event.preventDefault();

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const containerWidth = container.getBoundingClientRect().width;
    const paneCount = Math.max(panes.length, 1);
    const leftStart = paneWidths[leftPaneId] ?? 100 / paneCount;
    const rightStart = paneWidths[rightPaneId] ?? 100 / paneCount;
    const startX = event.clientX;
    let latestWidths = paneWidths;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const minPercent = 16;
      const combined = leftStart + rightStart;
      const nextLeft = clamp(leftStart + deltaPercent, minPercent, combined - minPercent);
      const nextRight = combined - nextLeft;

      latestWidths = {
        ...latestWidths,
        [leftPaneId]: nextLeft,
        [rightPaneId]: nextRight,
      };
      setPaneWidths(latestWidths);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onPaneWidthsChange?.(latestWidths);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const openMemoInPane = useCallback(
    (paneId: string, memo: MemoRow) => {
      const pane = panes.find(candidate => candidate.id === paneId);
      const nextEditor = createEditor('memo', {
        highlight: null,
        memoId: memo.id,
        mode: 'existing',
      });
      const nextEditors = pane ? getPaneEditors(pane) : [];

      onSelectMemoById(memo.id);
      onChangePane(paneId, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors:
          pane && nextEditors.length > 0
            ? nextEditors.map(editor =>
                editor.id === getActiveEditor(pane).id ? nextEditor : editor,
              )
            : [nextEditor],
      });
    },
    [onChangePane, onSelectMemoById, panes],
  );

  const handleChangeMemoText = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
    nextText: string,
  ) => {
    if (editor.memoId) {
      onUpdateMemo(editor.memoId, nextText);
      if (editor.highlight) {
        patchActiveEditor(pane, { highlight: null });
      }
      return;
    }

    if (!nextText.trim()) {
      patchActiveEditor(pane, { draftText: nextText, mode: 'draft' });
      return;
    }

    const createdMemo = onCreateMemo(nextText, editor.draftCategory);
    onSelectMemoById(createdMemo.id);
    patchActiveEditor(pane, {
      draftText: undefined,
      highlight: null,
      memoId: createdMemo.id,
      mode: 'existing',
    });
  };

  const insertDateToken = (editorId: string, token: string) => {
    setInsertTextRequests(previous => ({
      ...previous,
      [editorId]: {
        id: `split-date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: `${token} `,
      },
    }));
  };

  const clearInsertTextRequest = (editorId: string, requestId: string) => {
    setInsertTextRequests(previous => {
      if (previous[editorId]?.id !== requestId) {
        return previous;
      }
      const next = { ...previous };
      delete next[editorId];
      return next;
    });
  };

  const registerEditorSchedule = (editor: MemoSplitEditorState) => {
    const selectedText = editor.selectedText?.trim() ?? '';

    if (!selectedText) {
      window.alert('일정으로 등록할 문장을 먼저 선택하세요.');
      return;
    }

    const match = parseDates(selectedText, Date.now())[0];
    if (!match) {
      window.alert('선택한 문장 안에 날짜 표현이 필요합니다.');
      return;
    }

    void onSaveCalendarBlock({
      allDay:
        match.date.getHours() === 0 &&
        match.date.getMinutes() === 0,
      color: '#66705A',
      note: selectedText,
      startDate: match.date.toISOString(),
      title: selectedText,
    }).then(() => {
      window.alert('일정이 등록되었습니다.');
    });
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
        note: selectedText,
        startDate: date.toISOString(),
        title: selectedText,
      }).then(() => {
        window.alert('일정이 등록되었습니다.');
      });
    } else {
      insertDateToken(
        editor.id,
        format(date, allDay ? 'yy.MM.dd' : 'yy.MM.dd HH:mm'),
      );
    }
    setOpenDatePickerEditorId(null);
  };

  const renderHighlight = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
    value: string,
  ) => {
    if (!editor.highlight) {
      return null;
    }

    const startIndex = Math.max(0, editor.highlight.startIndex);
    const endIndex = Math.max(startIndex, editor.highlight.endIndex);
    const snippet =
      editor.highlight.chunkText ||
      value.slice(startIndex, Math.min(value.length, endIndex));

    return (
      <div className="highlight-card">
        <div className="highlight-header">
          <span className="highlight-label">관련 문장</span>
          <button
            onClick={() => patchActiveEditor(pane, { highlight: null })}
            className="highlight-close-btn"
          >
            ✕
          </button>
        </div>
        <p className="highlight-text">{snippet}</p>
      </div>
    );
  };

  const renderSourceBody = (result?: NetworkSearchResult) => {
    if (!result) {
      return (
        <div className="empty-source">
          <h4>출처가 없습니다</h4>
          <p>추천 결과를 클릭하면 요약 텍스트를 볼 수 있습니다.</p>
        </div>
      );
    }

    return (
      <div className="source-pane-content">
        <span className="source-kind">{getSourceLabel(result)}</span>
        <h3 className="source-title">{result.title ?? result.sourceLabel ?? '저장한 링크'}</h3>
        {result.sourceUrl && (
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="source-url-link"
          >
            {result.sourceUrl}
          </a>
        )}
        <div className="source-summary-card">
          <h5>추천에 사용된 요약</h5>
          <p>{result.chunkText || '요약이 없습니다.'}</p>
        </div>
      </div>
    );
  };

  const renderPaneBody = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
  ) => {
    if (editor.view === 'calendar') {
      return (
        <CalendarWorkspace
          blocks={calendarBlocks}
          onDeleteBlock={onDeleteCalendarBlock}
          onSaveBlock={onSaveCalendarBlock}
        />
      );
    }

    if (editor.view === 'briefing') {
      return (
        <BriefingWorkspace
          briefings={briefings}
          inboxItems={scheduleInbox}
          onAcceptInbox={onAcceptInbox}
          onDismissInbox={onDismissInbox}
        />
      );
    }

    if (editor.view === 'inbox') {
      return (
        <InboxWorkspace
          inboxItems={inboxItems}
          isLoading={isInboxLoading}
          onRefresh={onRefreshInbox}
          onSaveUrl={onSaveInboxUrl}
        />
      );
    }

    if (editor.view === 'network') {
      if (
        editor.networkIsLoading ||
        editor.networkErrorMessage ||
        editor.networkQueryChunk ||
        editor.networkResults
      ) {
        // KNN local search view
        const graph = buildSplitKnnGraph(editor.networkResults ?? []);

        return (
          <div className="split-network-search">
            <div className="network-search-header">
              <h4>네트워크</h4>
              <p>커서 문장 기준으로 탐색한 결과</p>
            </div>
            {editor.networkIsLoading && <p className="loading-text">연결성 찾는 중...</p>}
            {editor.networkErrorMessage && <p className="form-error">{editor.networkErrorMessage}</p>}
            {editor.networkResults && editor.networkResults.length > 0 && (
              <>
                <KnowledgeGraphView
                  activeNodeId="network:query"
                  ariaLabel="커서 문장 기준 유사 메모 그래프"
                  className="split-knowledge-graph"
                  edges={graph.edges}
                  nodes={graph.nodes}
                  onSelectNode={nodeId => {
                    if (!nodeId.startsWith('network:') || nodeId === 'network:query') {
                      return;
                    }

                    const chunkId = nodeId.slice('network:'.length);
                    const result = editor.networkResults?.find(item => item.chunkId === chunkId);
                    const target = result?.memoId ? memos.find(m => m.id === result.memoId) : null;

                    if (target) {
                      onSelectMemoById(target.id);
                      openMemoInPane(pane.id, target);
                    }
                  }}
                />
                <div className="split-network-results">
                  {editor.networkResults.map(res => (
                    <button
                      key={res.chunkId}
                      className="network-result-card"
                      onClick={() => {
                        const target = memos.find(m => m.id === res.memoId);
                        if (target) {
                          onSelectMemoById(target.id);
                          openMemoInPane(pane.id, target);
                        }
                      }}
                    >
                      <span>유사도 {Math.round(res.similarity * 100)}%</span>
                      <strong>{res.chunkText}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      }

      // Default Topic Clusters discovery view
      if (topicClusters.length > 0) {
        const activeTopicId =
          topicMemberships.find(membership => membership.memoId === editor.memoId)?.topicId ?? null;
        const graph = buildSplitTopicGraph(topicClusters, topicMemberships, editor.memoId);

        return (
          <div className="split-global-network">
            <h4>Topics</h4>
            <p>토픽 발견 맵</p>
            <KnowledgeGraphView
              activeNodeId={activeTopicId ? `topic:${activeTopicId}` : null}
              ariaLabel="토픽 지식 그래프"
              className="split-knowledge-graph"
              edges={graph.edges}
              nodes={graph.nodes}
              onSelectNode={nodeId => {
                if (!nodeId.startsWith('topic:')) {
                  return;
                }

                const topicId = nodeId.slice('topic:'.length);
                const memId = topicMemberships.find(m => m.topicId === topicId)?.memoId;
                const target = memId ? memos.find(m => m.id === memId) : null;

                if (target) {
                  onSelectMemoById(target.id);
                  openMemoInPane(pane.id, target);
                }
              }}
            />
            <div className="split-topic-list">
              {topicClusters.map(cluster => (
                <button
                  key={cluster.id}
                  className="split-topic-chip"
                  onClick={() => {
                    // Open first memo of topic
                    const memId = topicMemberships.find(m => m.topicId === cluster.id)?.memoId;
                    const target = memos.find(m => m.id === memId);
                    if (target) {
                      onSelectMemoById(target.id);
                      openMemoInPane(pane.id, target);
                    }
                  }}
                >
                  {cluster.label}
                </button>
              ))}
            </div>
          </div>
        );
      }

      // No backend topic clusters yet → fall back to a local category grouping
      // so the tab is still useful offline / before the nightly topic batch.
      const fallbackCategories = Array.from(
        new Set(memos.map(memo => getMemoCategory(memo.category))),
      );
      return (
        <div className="split-global-network">
          <h4>Topics</h4>
          <p>카테고리 기반 임시 묶음</p>
          {fallbackCategories.length > 0 ? (
            <div className="split-topic-list">
              {fallbackCategories.map(category => (
                <button
                  key={category}
                  className="split-topic-chip"
                  onClick={() => {
                    const target = memos.find(
                      memo => getMemoCategory(memo.category) === category,
                    );
                    if (target) {
                      onSelectMemoById(target.id);
                      openMemoInPane(pane.id, target);
                    }
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-text">아직 메모가 없습니다.</p>
          )}
          <p className="empty-text">
            아직 토픽 분석 결과가 없어 카테고리로 묶어 보여줍니다. 로그인 후 야간
            토픽 배치가 실행되면 자동 토픽 지도로 바뀝니다.
          </p>
        </div>
      );
    }

    if (editor.view === 'source') {
      return renderSourceBody(editor.sourceResult);
    }

    const memo = editor.memoId ? memoById.get(editor.memoId) ?? null : null;
    const value =
      editor.mode === 'existing'
        ? editor.draftText ?? memo?.content ?? ''
        : editor.draftText ?? '';
    const firstDateMatch = parseDates(
      value,
      memo?.created_at ? new Date(memo.created_at).getTime() : Date.now(),
    )[0] ?? null;
    const selectedText = editor.selectedText?.trim() ?? '';

    return (
      <div className="split-memo-pane-body">
        {renderHighlight(pane, editor, value)}
        <div className="split-editor-assist-row">
          <button
            className="quick-date-chip"
            onClick={() =>
              setOpenDatePickerEditorId(current =>
                current === editor.id ? null : editor.id,
              )
            }
            type="button"
          >
            날짜 선택
          </button>
          <button
            className="ghost-button"
            disabled={!selectedText}
            onClick={() => registerEditorSchedule(editor)}
            type="button"
          >
            <CalendarPlus size={16} />
            일정 등록
          </button>
          {firstDateMatch && (
            <span className="date-detect-chip">
              {firstDateMatch.text} : {format(firstDateMatch.date, 'yyyy.MM.dd')}
            </span>
          )}
          {selectedText && (
            <span className="selected-text-chip">
              선택됨: {selectedText.length > 30 ? `${selectedText.slice(0, 30)}...` : selectedText}
            </span>
          )}
        </div>
        {openDatePickerEditorId === editor.id && (
          <DateSchedulePopover
            onApplyDate={(date, allDay) => applyEditorDate(editor, date, allDay)}
            onClose={() => setOpenDatePickerEditorId(null)}
          />
        )}
        <SimpleEditor
          hideToolbar
          insertTextRequest={insertTextRequests[editor.id] ?? null}
          onEditorFocus={() => {
            onFocusPane?.(pane.id);
            setActiveEditorInstanceId(pane.id);
            if (editor.memoId) {
              onSelectMemoById(editor.memoId);
            }
          }}
          onEditorReady={instance => {
            setEditorInstances(previous => ({
              ...previous,
              [pane.id]: instance,
            }));
            if (instance && !activeEditorInstanceId) {
              setActiveEditorInstanceId(pane.id);
            }
          }}
          onInsertTextRequestHandled={requestId =>
            clearInsertTextRequest(editor.id, requestId)
          }
          value={value}
          onChange={(nextText: string) => handleChangeMemoText(pane, editor, nextText)}
          onSelectionChange={(selectedText: string, from: number, to: number) => {
            patchActiveEditor(pane, {
              selectionEnd: to,
              selectionStart: from,
              selectedText: selectedText.trim(),
            });
          }}
          autoFocus={false}
          showVersionLabel={false}
        />
      </div>
    );
  };

  const canUseMemoActions = Boolean(focusedPane && focusedEditor?.view === 'memo');
  const canRegisterFocusedSchedule = Boolean(
    canUseMemoActions && focusedEditor?.selectedText?.trim(),
  );

  return (
    <div className="split-workspace-shell">
      <div className="split-workspace-commandbar">
        {onToggleSession && isSessionCollapsed && (
          <TooltipIconButton
            className="split-command-button session-toggle-button"
            onClick={onToggleSession}
            tooltip="사이드바 열기"
          >
            <PanelLeft size={18} />
          </TooltipIconButton>
        )}
        {activeToolbarEditor ? (
          // Buttons need a real editor instance (the tiptap-ui buttons read it
          // during render and crash on null). When the focused pane isn't an
          // editor we keep them rendered but disabled; only when NO editor
          // exists anywhere do we fall back to an empty, inert host.
          <SimpleEditorToolbar
            editor={activeToolbarEditor}
            disabled={!isToolbarActive}
          />
        ) : (
          <div className="simple-editor-toolbar-host is-disabled" />
        )}
        <div className="split-workspace-actions" aria-label="레거시 상단 기능">
          <TooltipIconButton
            className="split-command-button"
            disabled={!canRegisterFocusedSchedule}
            onClick={() => {
              if (focusedEditor) {
                registerEditorSchedule(focusedEditor);
              }
            }}
            tooltip="일정 등록"
          >
            <CalendarPlus size={16} />
          </TooltipIconButton>
          <TooltipIconButton
            className="split-command-button"
            disabled={!canUseMemoActions || !focusedPane || !focusedEditor}
            onClick={() => {
              if (focusedPane && focusedEditor) {
                void runEditorNetworkSearch(focusedPane, focusedEditor);
              }
            }}
            tooltip="네트워크 검색"
          >
            <Network size={16} />
          </TooltipIconButton>
          <TooltipIconButton
            className="split-command-button"
            disabled={!canAddPane}
            onClick={onAddPane}
            tooltip={
              canAddPane
                ? 'split 패널 추가'
                : 'split 패널은 최대 3개까지 열 수 있습니다'
            }
          >
            <Columns2 size={18} />
          </TooltipIconButton>
        </div>
      </div>
      <div className="split-workspace-container" ref={containerRef}>
      {panes.map(pane => {
        const editors = getPaneEditors(pane);
        const activeEditor = getActiveEditor(pane);
        const isMenuOpen = openMenuPaneId === pane.id;
        const paneIndex = panes.findIndex(candidate => candidate.id === pane.id);
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
              <div className="split-pane-header">
              <div className="split-editor-tabs-scroll">
                <div className="split-editor-tabs">
                  {editors.map(editor => (
                    <button
                      key={editor.id}
                      onClick={() => {
                        onChangePane(pane.id, {
                          ...mirrorEditorPatch(editor),
                          activeEditorId: editor.id,
                          editors,
                        });
                        onFocusPane?.(pane.id);
                        if (editor.memoId) {
                          onSelectMemoById(editor.memoId);
                        }
                      }}
                      className={`split-editor-tab ${editor.id === activeEditor.id ? 'active' : ''}`}
                    >
                      <span className="split-tab-label">
                        {VIEW_LABELS[editor.view]}
                      </span>
                      <span
                        aria-label="탭 닫기"
                        className="split-tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseEditor(pane, editor.id);
                        }}
                        role="button"
                      >
                        <X size={13} strokeWidth={2.4} />
                      </span>
                    </button>
                  ))}
                  <TooltipIconButton
                    className="split-editor-tab-add"
                    onClick={() => handleAddEditor(pane)}
                    tooltip="새 탭"
                  >
                    <Plus size={15} strokeWidth={2.4} />
                  </TooltipIconButton>
                </div>
              </div>
              <div className="split-pane-actions">
                <TooltipIconButton
                  onClick={onAddPane}
                  className="split-action-btn"
                  disabled={!canAddPane}
                  tooltip={
                    canAddPane
                      ? 'split 패널 추가'
                      : 'split 패널은 최대 3개까지 열 수 있습니다'
                  }
                >
                  <Columns2 size={14} />
                </TooltipIconButton>
                <TooltipIconButton
                  onClick={() =>
                    setOpenMenuPaneId(current =>
                      current === pane.id ? null : pane.id,
                    )
                  }
                  className={`split-action-btn ${isMenuOpen ? 'active' : ''}`}
                  tooltip="탭 메뉴"
                >
                  <ChevronDown size={15} strokeWidth={2.4} />
                </TooltipIconButton>
                <TooltipIconButton
                  disabled={panes.length <= 1}
                  onClick={() =>
                    onClosePane ? onClosePane(pane.id) : onCloseAllPanes?.()
                  }
                  className="split-action-btn"
                  tooltip={
                    panes.length <= 1
                      ? '마지막 패널은 닫을 수 없습니다'
                      : '패널 닫기'
                  }
                >
                  ×
                </TooltipIconButton>
              </div>
              {isMenuOpen && (
                <div className="split-pane-menu-dropdown">
                  <div className="split-menu-title-row">스택 탭</div>
                  <button
                    className="split-menu-item split-menu-item-muted"
                    disabled
                    type="button"
                  >
                    {editors.length}개의 탭 북마크...
                  </button>
                  <div className="split-menu-separator" />
                  <button
                    className="split-menu-item"
                    onClick={() => handleCloseAllEditors(pane)}
                    type="button"
                  >
                    모두 닫기
                  </button>
                  <div className="split-menu-separator" />
                  {MENU_VIEWS.map(view => (
                    <button
                      key={view}
                      onClick={() => {
                        handleSelectEditorView(pane, view);
                      }}
                      className={`split-menu-item split-menu-view-item ${activeEditor.view === view ? 'active' : ''}`}
                      type="button"
                    >
                      <span className="split-menu-check">
                        {activeEditor.view === view ? (
                          <Check size={14} strokeWidth={2.8} />
                        ) : null}
                      </span>
                      <span>{VIEW_LABELS[view]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
              <div className="split-pane-body-wrapper">
                {renderPaneBody(pane, activeEditor)}
              </div>
            </div>
            {paneIndex < panes.length - 1 && (
              <div
                aria-hidden
                className="split-pane-resizer"
                onMouseDown={event =>
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
