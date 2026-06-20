import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Editor } from '@tiptap/core';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Network,
  PanelLeft,
  PanelLeftClose,
  Plus,
  X,
} from '@/components/icons';
import { MemoRow, CalendarBlockRow, BriefingRow, ScheduleInboxRow, TopicCluster, TopicMemoEdge, TopicMembership } from '../../../types';
import { MemoChunk } from '../../../lib/memoChunker';
import { NetworkSearchResult } from '../../../services/backend/networkService';
import {
  SimpleEditor,
  SimpleEditorToolbar,
} from '../../../components/tiptap-templates/simple/simple-editor';
import TooltipIconButton from '../../../components/TooltipIconButton';
import CalendarWorkspace from '../../calendar/TuiCalendarWorkspace';
import BriefingWorkspace from '../../briefing/BriefingWorkspace';
import InboxWorkspace from '../../inbox/InboxWorkspace';
import { formatRelativeDisplayDate, parseDates } from '../../../lib/dateParser';
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
const DATE_QUICK_ACTIONS = ['오늘', '내일', '모레'];

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

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
      label: '무의식',
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

const mirrorEditorPatch = (
  editor: MemoSplitEditorState,
): Partial<MemoSplitPaneState> => ({
  draftText: editor.draftText,
  highlight: editor.highlight,
  memoId: editor.memoId,
  mode: editor.mode,
  networkErrorMessage: editor.networkErrorMessage,
  networkIsLoading: editor.networkIsLoading,
  networkQueryChunk: editor.networkQueryChunk,
  networkRequestId: editor.networkRequestId,
  networkResults: editor.networkResults,
  selectedText: editor.selectedText,
  sourceResult: editor.sourceResult,
  view: editor.view,
});

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
  activeMemoId: string | null;
  isSessionCollapsed?: boolean;
  onChangePane: (id: string, patch: Partial<MemoSplitPaneState>) => void;
  onCloseAllPanes?: () => void;
  onToggleSession?: () => void;
  panes: MemoSplitPaneState[];
  memos: MemoRow[];
  onCreateMemo: (content: string) => MemoRow;
  onDeleteMemo: (id: string) => void;
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
  topicEdges: TopicMemoEdge[];
  topicMemberships: TopicMembership[];
}

const MemoSplitWorkspace = ({
  isSessionCollapsed = false,
  onChangePane,
  onCloseAllPanes,
  onToggleSession,
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
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [activeEditorInstanceId, setActiveEditorInstanceId] = useState<string | null>(
    null,
  );
  const [editorInstances, setEditorInstances] = useState<
    Record<string, Editor | null>
  >({});
  const memoById = useMemo(() => {
    return new Map(memos.map(memo => [memo.id, memo]));
  }, [memos]);

  const focusedPane = useMemo(
    () =>
      panes.find(pane => pane.id === activePaneId) ??
      panes[0] ??
      null,
    [activePaneId, panes],
  );
  const focusedEditor = focusedPane ? getActiveEditor(focusedPane) : null;

  const resolveLiveEditor = (id?: string | null) => {
    if (!id) {
      return null;
    }
    const instance = editorInstances[id];
    return instance && !instance.isDestroyed ? instance : null;
  };

  const activeToolbarEditor =
    resolveLiveEditor(focusedEditor?.id) ?? resolveLiveEditor(activeEditorInstanceId);

  useEffect(() => {
    const liveIds = new Set<string>();
    for (const pane of panes) {
      for (const paneEditor of getPaneEditors(pane)) {
        liveIds.add(paneEditor.id);
      }
    }

    setEditorInstances(previous => {
      const entries = Object.entries(previous).filter(([id]) => liveIds.has(id));
      return entries.length === Object.keys(previous).length
        ? previous
        : Object.fromEntries(entries);
    });
    setActiveEditorInstanceId(previous =>
      previous && liveIds.has(previous) ? previous : null,
    );
    setActivePaneId(previous =>
      previous && panes.some(pane => pane.id === previous)
        ? previous
        : panes[0]?.id ?? null,
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

  const handleAddEditor = useCallback(
    (pane: MemoSplitPaneState) => {
      const nextEditor = createEditor('memo');

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: [...getPaneEditors(pane), nextEditor],
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

  const openMemoInPane = useCallback(
    (paneId: string, memo: MemoRow) => {
      const pane = panes.find(candidate => candidate.id === paneId);
      const nextEditor = createEditor('memo', {
        highlight: null,
        memoId: memo.id,
        mode: 'existing',
      });
      const nextEditors = pane ? getPaneEditors(pane) : [];

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
      onSelectMemoById(memo.id);
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

    const createdMemo = onCreateMemo(nextText);
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
          inboxItems={inboxItems ?? []}
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
                        if (target) openMemoInPane(pane.id, target);
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
      const activeTopicId =
        topicMemberships.find(membership => membership.memoId === editor.memoId)?.topicId ?? null;
      const graph = buildSplitTopicGraph(topicClusters, topicMemberships, editor.memoId);

      return (
        <div className="split-global-network">
          <h4>무의식 지도</h4>
          <p>토픽 발견 맵</p>
          {topicClusters.length > 0 && (
            <KnowledgeGraphView
              activeNodeId={activeTopicId ? `topic:${activeTopicId}` : null}
              ariaLabel="무의식 토픽 지식 그래프"
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
                  openMemoInPane(pane.id, target);
                }
              }}
            />
          )}
          <div className="split-topic-list">
            {topicClusters.map(cluster => (
              <button
                key={cluster.id}
                className="split-topic-chip"
                onClick={() => {
                  // Open first memo of topic
                  const memId = topicMemberships.find(m => m.topicId === cluster.id)?.memoId;
                  const target = memos.find(m => m.id === memId);
                  if (target) openMemoInPane(pane.id, target);
                }}
              >
                {cluster.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (editor.view === 'source') {
      return renderSourceBody(editor.sourceResult);
    }

    const memo = editor.memoId ? memoById.get(editor.memoId) ?? null : null;
    const value =
      editor.mode === 'existing' ? memo?.content ?? '' : editor.draftText ?? '';
    const firstDateMatch = parseDates(
      value,
      memo?.created_at ? new Date(memo.created_at).getTime() : Date.now(),
    )[0] ?? null;
    const selectedText = editor.selectedText?.trim() ?? '';

    return (
      <div className="split-memo-pane-body">
        {renderHighlight(pane, editor, value)}
        <div className="split-editor-assist-row">
          {DATE_QUICK_ACTIONS.map(token => (
            <button
              className="quick-date-chip"
              key={token}
              onClick={() => insertDateToken(editor.id, token)}
              type="button"
            >
              {token}
            </button>
          ))}
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
              {firstDateMatch.text} → {formatRelativeDisplayDate(firstDateMatch.date)}
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
            setActivePaneId(pane.id);
            setActiveEditorInstanceId(editor.id);
            if (editor.memoId) {
              onSelectMemoById(editor.memoId);
            }
          }}
          onEditorReady={instance => {
            setEditorInstances(previous => ({
              ...previous,
              [editor.id]: instance,
            }));
            if (instance && !activeEditorInstanceId) {
              setActiveEditorInstanceId(editor.id);
            }
          }}
          onInsertTextRequestHandled={requestId =>
            clearInsertTextRequest(editor.id, requestId)
          }
          value={value}
          onChange={(nextText: string) => handleChangeMemoText(pane, editor, nextText)}
          onSelectionChange={(selectedText: string) => {
            patchActiveEditor(pane, { selectedText: selectedText.trim() });
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
        {onToggleSession && (
          <TooltipIconButton
            className="split-command-button session-toggle-button"
            onClick={onToggleSession}
            tooltip={isSessionCollapsed ? '사이드바 열기' : '사이드바 접기'}
          >
            {isSessionCollapsed ? (
              <PanelLeft size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </TooltipIconButton>
        )}
        {activeToolbarEditor ? (
          <SimpleEditorToolbar editor={activeToolbarEditor} />
        ) : (
          <div className="simple-editor-toolbar-host" />
        )}
        <div className="split-workspace-actions" aria-label="상단 명령">
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
            disabled={!focusedPane || !focusedEditor}
            onClick={() => {
              if (focusedPane) {
                handleSelectEditorView(focusedPane, 'network');
              }
            }}
            tooltip="무의식 보기"
          >
            <Network size={16} />
          </TooltipIconButton>
          <TooltipIconButton
            className="split-command-button"
            disabled
            tooltip="Windows Stage 3에서는 단일 패널을 유지합니다"
          >
            <X size={16} />
          </TooltipIconButton>
        </div>
      </div>
      <div className="split-workspace-container">
        {panes.map(pane => {
          const editors = getPaneEditors(pane);
          const activeEditor = getActiveEditor(pane);
          const isMenuOpen = openMenuPaneId === pane.id;

          return (
            <div
              key={pane.id}
              className={`split-pane ${activePaneId === pane.id ? 'focused' : ''}`}
              onMouseDown={() => setActivePaneId(pane.id)}
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
                        setActivePaneId(pane.id);
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
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCloseEditor(pane, editor.id);
                        }}
                        role="button"
                      >
                        <X size={13} />
                      </span>
                    </button>
                  ))}
                  <TooltipIconButton
                    className="split-editor-tab-add"
                    onClick={() => handleAddEditor(pane)}
                    tooltip="새 탭"
                  >
                    <Plus size={15} />
                  </TooltipIconButton>
                </div>
              </div>
              <div className="split-pane-actions">
                <TooltipIconButton
                  onClick={() =>
                    setOpenMenuPaneId(current =>
                      current === pane.id ? null : pane.id,
                    )
                  }
                  className={`split-action-btn ${isMenuOpen ? 'active' : ''}`}
                  tooltip="탭 메뉴"
                >
                  <ChevronDown size={15} />
                </TooltipIconButton>
                <TooltipIconButton
                  disabled={panes.length <= 1}
                  onClick={onCloseAllPanes}
                  className="split-action-btn"
                  tooltip={
                    panes.length <= 1
                      ? '마지막 패널은 닫을 수 없습니다'
                      : '패널 닫기'
                  }
                >
                  <X size={15} />
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
                        {activeEditor.view === view ? <Check size={14} /> : null}
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
          );
        })}
      </div>
    </div>
  );
};

export default MemoSplitWorkspace;
