import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Skeleton, Tooltip, VisuallyHidden } from '@mantine/core';
import type { Editor } from '@tiptap/core';
import { formatRelativeDay } from '../../../lib/relativeDay';
import {
  type AppShortcutSettings,
  formatHotkeyHint,
  formatHotkeyTooltip,
} from '../../../lib/shortcutSettings';
import SubnotaScatterMark from '../../../components/SubnotaScatterMark';
import {
  AppWindow,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCopy,
  Cloud,
  Columns2,
  Copy,
  Download,
  Inbox,
  MoreHorizontal,
  Network,
  NotebookText,
  PanelLeft,
  PanelLeftClose,
  Pin,
  PinSolid,
  Plus,
  Search,
  Topics,
  Trash2,
  X,
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
import { copyTextToClipboard } from '../../../lib/copy-code';
import type { AmbientSearchTarget } from '../../../lib/ambientSearch';
import {
  NetworkSearchResult,
  formatNetworkSearchErrorMessage,
  isNetworkSearchRetryableMessage,
  searchStateB,
} from '../../../services/backend/networkService';
import { NETWORK_MIN_SIMILARITY } from '../../../lib/constants';
import { EditorContext } from '@tiptap/react';
import { UndoRedoButton } from '../../../components/tiptap-ui/undo-redo-button/undo-redo-button';
import {
  type AmbientGhost,
  type AmbientIdleAnchor,
  NoteFixedToolbar,
  SimpleEditor,
} from '../../../components/tiptap-templates/simple/simple-editor';
import CalendarWorkspace from '../../calendar/CalendarWorkspace';
import ScheduleInboxWorkspace from '../../schedule/ScheduleInboxWorkspace';
import InboxWorkspace from '../../inbox/InboxWorkspace';
import { getMemoCategory } from '../../../lib/memoCategory';
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
import DateSchedulePopover from './DateSchedulePopover';
import ScheduleConfirmPopover from './ScheduleConfirmPopover';
import SourceDetailPane from './SourceDetailPane';
import KnowledgeGraphView, {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './KnowledgeGraphView';
import {
  capCrossTopicBridges,
  capIntraTopicEdges,
  getSimilarityMapGeometry,
  GRAPH_COLORS,
  GRAPH_INBOX_NODE,
  LINK_NODE_ICON,
  NOTE_NODE_ICON,
} from './knowledgeGraph';
import EmptyState from '../../../components/EmptyState';
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

const VIEW_LABELS: Record<MemoSplitPaneView, { en: string; ko: string }> = {
  briefing: { en: 'Schedule inbox', ko: '일정 저장함' },
  calendar: { en: 'Calendar', ko: '캘린더' },
  inbox: { en: 'Link inbox', ko: '링크 저장함' },
  memo: { en: 'Note', ko: '노트' },
  network: { en: 'Nearby notes', ko: '주변 메모' },
  source: { en: 'Web summary', ko: '웹 요약' },
  topics: { en: 'Topics', ko: 'Topics' },
};

const viewLabel = (view: MemoSplitPaneView, language: 'en' | 'ko') =>
  VIEW_LABELS[view][language];

const getMemoTabLabel = (content: string, language: 'en' | 'ko') => {
  const firstContentLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return firstContentLine ?? viewLabel('memo', language);
};

const EDITOR_TAB_DRAG_TYPE = 'application/x-subnota-editor-tab';

type TabDropTarget = {
  editorId?: string;
  paneId: string;
  position: 'after' | 'before';
};

// network·source는 네트워크 검색·웹 요약 열기의 결과로만 열리는 뷰라
// 사용자가 직접 고르는 목록에서는 제외한다.
const MENU_VIEWS: MemoSplitPaneView[] = ['memo', 'inbox', 'calendar', 'topics'];

const VIEW_ICONS: Partial<Record<MemoSplitPaneView, typeof NotebookText>> = {
  briefing: Inbox,
  calendar: CalendarDays,
  inbox: AppWindow,
  memo: NotebookText,
  topics: Topics,
};
// Drag floor only — keeps a pane grabbable. Auto-layout (window narrowing) has no
// floor (CSS min-width:0), so content panes clip rather than forcing a scrollbar.
const SPLIT_PANE_MIN_WIDTH_PX = 240;
const TOPIC_GRAPH_MEMO_NODE_LIMIT = 32;
// Cross-topic pairs keep only their strongest bridges (same as the rail map).
const TOPIC_BRIDGE_EDGE_LIMIT = 2;
// Intra-topic edges: per-memo KNN union + similarity floor. Backend ships
// top-8/0.38 which renders as a clique; our edge data sits at p50≈0.44 with
// real matches ≥0.7, so 3/0.45 keeps the strong skeleton only.
const TOPIC_INTRA_EDGE_TOP_K = 3;
const TOPIC_INTRA_EDGE_MIN_SIMILARITY = 0.45;
// Distinct hues so clusters read as different color groups. First three match
// the topics-network reference mock (violet-blue / green / orange-red);
// assigned by cluster index in buildSplitTopicGraph.
const TOPIC_COLORS = [
  '#8f8ee0',
  '#5cb84d',
  '#d1502c',
  '#b8892b',
  '#4aa5a5',
  '#c04f7a',
  '#3d7dbf',
  '#7b6240',
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
  isViewPicker: pane.isViewPicker,
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
    editors.find((editor) => editor.id === pane.activeEditorId) ?? editors[0]
  );
};

const PaneBodyRenderer = ({ render }: { render: () => React.ReactNode }) => (
  <>{render()}</>
);

const mirrorEditorPatch = (
  editor: MemoSplitEditorState,
): Partial<MemoSplitPaneState> => ({
  draftCategory: editor.draftCategory,
  draftText: editor.draftText,
  highlight: editor.highlight,
  isViewPicker: editor.isViewPicker,
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

const getGraphMemoTitle = (
  memo: MemoRow,
  language: 'en' | 'ko',
  limit = 13,
) => {
  const title =
    memo.content
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? localize(language, '제목 없는 노트', 'Untitled note');

  return title.length > limit ? `${title.slice(0, limit).trimEnd()}...` : title;
};

const showTopicFolderFromGraph = (topicId: string, memoId?: string) => {
  window.dispatchEvent(
    new CustomEvent('subnota:show-topic-folder', {
      detail: { memoId, topicId },
    }),
  );
};

const buildSplitKnnGraph = (
  results: NetworkSearchResult[],
  getLabel: (result: NetworkSearchResult) => string,
  language: 'en' | 'ko',
) => {
  // State B is an edge-less similarity map centered on the current memo.
  // Similarity is encoded by both radial distance and node size.
  const nodes: KnowledgeGraphNode[] = [
    {
      color: '#1d1d1f',
      id: 'network:query',
      label: localize(language, '현재 메모', 'Current note'),
      size: 15,
      x: 0,
      y: 0,
    },
  ];
  const edges: KnowledgeGraphEdge[] = [];
  const total = Math.max(results.length, 1);
  const similarities = results.map((result) => clamp(result.similarity, 0, 1));
  const lowestSimilarity = Math.min(...similarities, 1);
  const highestSimilarity = Math.max(...similarities, 0);

  results.forEach((result, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const similarity = clamp(result.similarity, 0, 1);
    const geometry = getSimilarityMapGeometry(
      similarity,
      lowestSimilarity,
      highestSimilarity,
      NETWORK_MIN_SIMILARITY,
    );
    const nodeId = `network:${result.chunkId}`;

    nodes.push({
      color:
        result.sourceKind === 'inbox'
          ? GRAPH_INBOX_NODE
          : GRAPH_COLORS.defaultNode,
      id: nodeId,
      image: result.sourceKind === 'inbox' ? LINK_NODE_ICON : NOTE_NODE_ICON,
      label: getLabel(result),
      size: geometry.size,
      x: Math.cos(angle) * geometry.distance,
      y: Math.sin(angle) * geometry.distance,
    });
  });

  return { edges, nodes };
};

const getResultTitle = (
  result: NetworkSearchResult,
  memos: MemoRow[],
  language: 'en' | 'ko',
) => {
  if (result.sourceKind === 'inbox') {
    return result.title || result.sourceLabel || localize(language, '링크', 'Link');
  }
  const memo = result.memoId
    ? memos.find((item) => item.id === result.memoId)
    : null;
  const source = memo?.content ?? result.memoContent ?? result.chunkText ?? '';
  const firstLine = source
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return localize(language, '제목 없는 노트', 'Untitled note');
  }
  return firstLine.length > 22
    ? `${firstLine.slice(0, 22).trimEnd()}…`
    : firstLine;
};

const formatTopicUpdatedAt = (updatedAt: string | null | undefined) => {
  if (!updatedAt) {
    return null;
  }

  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? null : format(date, 'yyyy.MM.dd HH:mm');
};

// Topics는 갱신 중에도 기존 결과(또는 로컬 폴백)를 지우지 않는다. 갱신
// 사실은 제목 옆의 이 점 하나로만 알린다 — 패널 전체를 덮지 않는다.
const TopicsBusyDot = ({ language }: { language: 'en' | 'ko' }) => (
  <>
    <span aria-hidden="true" className="inline-busy" />
    <VisuallyHidden role="status">
      {localize(language, 'Topics 갱신 중', 'Updating topics')}
    </VisuallyHidden>
  </>
);

const getGraphInboxTitle = (
  item: InboxSession,
  language: 'en' | 'ko',
  limit = 13,
) => {
  const title =
    item.title ?? item.domain ?? localize(language, '저장한 링크', 'Saved link');
  return title.length > limit ? `${title.slice(0, limit).trimEnd()}...` : title;
};

// Shape a saved inbox summary like a network result so the shared source view
// (renderSourceBody / openSourceInPane) can display it.
const inboxSessionToSourceResult = (
  item: InboxSession,
): NetworkSearchResult => ({
  chunkId: `inbox-${item.id}`,
  chunkText: item.summaryOneLiner ?? item.summary ?? item.description ?? '',
  createdAt: item.createdAt ? Date.parse(item.createdAt) : null,
  endIndex: 0,
  inboxSessionId: item.id,
  memoContent: null,
  memoCreatedAt: null,
  memoId: null,
  memoUpdatedAt: null,
  similarity: 0,
  sourceKind: 'inbox',
  sourceLabel: item.channelTitle ?? item.domain,
  sourceType: item.sourceType,
  sourceUrl: item.canonicalUrl ?? item.originalUrl,
  startIndex: 0,
  thumbnailUrl: item.thumbnailUrl,
  title: item.title,
});

// 미리보기 패널은 NetworkSearchResult를 받는다. 검색이 아니라 메모를 직접
// 지목해서 여는 경로(Topics 칩, 캘린더 원본 노트)에서는 하이라이트할 청크가
// 없으므로 start/end를 0으로 두고 본문 전체만 보여준다.
const memoToPreviewResult = (memo: MemoRow): NetworkSearchResult => ({
  chunkId: `memo-${memo.id}`,
  chunkText: '',
  createdAt: memo.created_at ? Date.parse(memo.created_at) : null,
  endIndex: 0,
  inboxSessionId: null,
  memoContent: memo.content,
  memoCreatedAt: memo.created_at ? Date.parse(memo.created_at) : null,
  memoId: memo.id,
  memoUpdatedAt: memo.updated_at ? Date.parse(memo.updated_at) : null,
  similarity: 0,
  sourceKind: 'memo',
  sourceLabel: null,
  sourceType: null,
  sourceUrl: null,
  startIndex: 0,
  thumbnailUrl: null,
  title: null,
});

const buildSplitTopicGraph = (
  clusters: TopicCluster[],
  memberships: TopicMembership[],
  globalEdges: MemoSimilarityEdge[],
  memos: MemoRow[],
  activeMemoId: string | null,
  inboxMemberships: TopicInboxMembership[] = [],
  inboxEdges: TopicMemoInboxEdge[] = [],
  inboxItems: InboxSession[] = [],
  language: 'en' | 'ko',
) => {
  const memoById = new Map(memos.map((memo) => [memo.id, memo]));
  const inboxItemById = new Map(inboxItems.map((item) => [item.id, item]));
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const total = Math.max(clusters.length, 1);
  // Push clusters onto a wider ring as their count grows so they don't overlap.
  const topicRing = 1.4 + total * 0.18;
  // Per-cluster color by index → the first 8 clusters are always distinct.
  const topicColor = new Map(
    clusters.map((cluster, index) => [
      cluster.id,
      TOPIC_COLORS[index % TOPIC_COLORS.length],
    ]),
  );
  const colorOf = (id: string | null | undefined) =>
    (id && topicColor.get(id)) || TOPIC_COLORS[0];

  clusters.forEach((cluster, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const topicMemberships = memberships.filter(
      (item) => item.topicId === cluster.id,
    );
    const isActiveLinked = Boolean(
      activeMemoId &&
      topicMemberships.some((item) => item.memoId === activeMemoId),
    );
    const count = Math.max(
      cluster.memoCount,
      topicMemberships.length,
      isActiveLinked ? 1 : 0,
    );
    const nodeId = `topic:${cluster.id}`;

    nodes.push({
      color: isActiveLinked ? '#236b45' : colorOf(cluster.id),
      forceLabel: true,
      id: nodeId,
      kind: 'topic',
      label: cluster.label,
      // Hub size grows with cluster weight, but capped like the rail map —
      // 24 turned the active hub (+3 from the reducer) into a black hole.
      size: clamp(9 + count * 0.9 + (cluster.confidence ?? 0) * 3, 10, 16),
      topicId: cluster.id,
      x: Math.cos(angle) * topicRing,
      y: Math.sin(angle) * topicRing,
    });

    topicMemberships
      .map((membership) => ({
        memo: memoById.get(membership.memoId),
        score: membership.score ?? 0.5,
      }))
      .filter((row): row is { memo: MemoRow; score: number } =>
        Boolean(row.memo),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, TOPIC_GRAPH_MEMO_NODE_LIMIT)
      .forEach(({ memo, score }, memoIndex, memoRows) => {
        const memoAngle =
          (Math.PI * 2 * memoIndex) / Math.max(memoRows.length, 1);
        // Orbit grows with the node count so a busy cluster fans out into a
        // readable ring instead of piling into one dense disk.
        const memoOrbit = 0.18 + memoRows.length * 0.02;
        const memoNodeId = `memo:${memo.id}`;

        nodes.push({
          color: memo.id === activeMemoId ? '#236b45' : colorOf(cluster.id),
          // No forced labels: real data has many same-title memos, so Sigma's
          // density culling + hover reveal keeps the map readable (rail policy).
          id: memoNodeId,
          image: NOTE_NODE_ICON,
          kind: 'memo',
          label: getGraphMemoTitle(memo, language),
          memoId: memo.id,
          size: clamp(
            4.5 + score * 4 + (memo.id === activeMemoId ? 2 : 0),
            5,
            10,
          ),
          topicId: cluster.id,
          x: Math.cos(angle) * topicRing + Math.cos(memoAngle) * memoOrbit,
          y: Math.sin(angle) * topicRing + Math.sin(memoAngle) * memoOrbit,
        });
        edges.push({
          id: `${nodeId}-${memoNodeId}`,
          source: nodeId,
          target: memoNodeId,
          weight: clamp(score, 0.25, 1) * 0.55,
        });
      });

    // Saved web-inbox summaries attached to this topic — link-icon leaves on
    // a hub spoke; the force layout settles them next to the memo members.
    inboxMemberships
      .filter((membership) => membership.topicId === cluster.id)
      .map((membership) => ({
        item: inboxItemById.get(membership.inboxSessionId),
        score: membership.score ?? 0.5,
      }))
      .filter((row): row is { item: InboxSession; score: number } =>
        Boolean(row.item),
      )
      .forEach(({ item, score }, inboxIndex, rows) => {
        const inboxAngle =
          (Math.PI * 2 * inboxIndex) / Math.max(rows.length, 1) + Math.PI / 5;
        const inboxNodeId = `inbox:${item.id}`;

        nodes.push({
          color: colorOf(cluster.id),
          id: inboxNodeId,
          image: LINK_NODE_ICON,
          label: getGraphInboxTitle(item, language),
          size: clamp(4.5 + score * 4, 5, 9),
          topicId: cluster.id,
          x: Math.cos(angle) * topicRing + Math.cos(inboxAngle) * 0.3,
          y: Math.sin(angle) * topicRing + Math.sin(inboxAngle) * 0.3,
        });
        edges.push({
          id: `${nodeId}-${inboxNodeId}`,
          source: nodeId,
          target: inboxNodeId,
          weight: clamp(score, 0.25, 1) * 0.55,
        });
      });
  });

  const simplifiedGlobalEdges = capIntraTopicEdges(
    globalEdges,
    TOPIC_INTRA_EDGE_TOP_K,
    TOPIC_INTRA_EDGE_MIN_SIMILARITY,
  );
  // Node selection must not reshape the map. Topics stay distinguished by
  // color while the same full set of sparse intra-topic and bridge edges
  // remains visible before and after a click.
  const visibleGlobalEdges = capCrossTopicBridges(
    simplifiedGlobalEdges,
    TOPIC_BRIDGE_EDGE_LIMIT,
  );

  visibleGlobalEdges.forEach((edge, index) => {
    const isIntraTopic =
      Boolean(edge.sourceTopicId) && edge.sourceTopicId === edge.targetTopicId;
    edges.push({
      color: isIntraTopic ? colorOf(edge.sourceTopicId) : '#c8beb0',
      id: `split-global-memo-edge-${edge.sourceMemoId}-${edge.targetMemoId}-${index}`,
      // Cross-topic edges stay visible but hairline-thin so the long lines
      // between clusters don't turn the map into spaghetti.
      size: isIntraTopic ? undefined : 0.35 + edge.similarity * 0.45,
      source: `memo:${edge.sourceMemoId}`,
      target: `memo:${edge.targetMemoId}`,
      weight: edge.similarity,
    });
  });

  inboxEdges.forEach((edge, index) => {
    edges.push({
      color: colorOf(edge.topicId),
      id: `split-memo-inbox-edge-${edge.memoId}-${edge.inboxSessionId}-${index}`,
      size: 0.35 + edge.similarity * 0.45,
      source: `memo:${edge.memoId}`,
      target: `inbox:${edge.inboxSessionId}`,
      weight: edge.similarity,
    });
  });

  return { edges, nodes };
};

const getSourceLabel = (result: NetworkSearchResult, language: 'en' | 'ko') => {
  if (result.sourceKind === 'memo') {
    return localize(language, '노트', 'Note');
  }
  if (result.sourceLabel) {
    return result.sourceLabel;
  }
  return localize(language, '웹페이지', 'Web page');
};

interface MemoSplitWorkspaceProps {
  ambientEditorId?: string | null;
  ambientEmptyEditorId?: string | null;
  ambientError?: string | null;
  ambientPendingEditorId?: string | null;
  ambientResult?: NetworkSearchResult | null;
  onMemoEditorBlur?: (memoId: string) => void;
  onBeforeNetworkSearch?: () => Promise<void>;
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
  isTopicsLoading?: boolean;
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
  onBeforeNetworkSearch,
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
  isTopicsLoading = false,
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
  const [scheduleConfirm, setScheduleConfirm] = useState<{
    anchor: {
      left: number;
      top: number;
      width: number;
    };
    editorId: string;
    date: Date;
    allDay: boolean;
    title: string;
    label: string;
    selectionEnd: number;
    selectionStart: number;
  } | null>(null);
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
  const [focusedTopicId, setFocusedTopicId] = useState<string | null>(null);
  const [topicFocusId, setTopicFocusId] = useState<string | null>(null);
  const [focusedMemoId, setFocusedMemoId] = useState<string | null>(null);
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
  const networkControllersRef = useRef<Map<string, AbortController>>(new Map());
  const panesRef = useRef(panes);
  const paneIdsRef = useRef(panes.map((pane) => pane.id).join('|'));
  const draggedTabRef = useRef<{ editorId: string; paneId: string } | null>(
    null,
  );

  useEffect(() => {
    const handleShowTopicFolder = (event: Event) => {
      const detail = (
        event as CustomEvent<{ memoId?: string; topicId?: string }>
      ).detail;
      setFocusedTopicId(detail?.topicId ?? null);
      setFocusedMemoId(detail?.memoId ?? null);
    };

    window.addEventListener('subnota:show-topic-folder', handleShowTopicFolder);
    return () =>
      window.removeEventListener(
        'subnota:show-topic-folder',
        handleShowTopicFolder,
      );
  }, []);

  useEffect(() => {
    panesRef.current = panes;
  }, [panes]);

  useEffect(() => {
    const liveEditorIds = new Set(
      panes.flatMap((pane) => getPaneEditors(pane).map((editor) => editor.id)),
    );
    for (const [editorId, controller] of networkControllersRef.current) {
      if (!liveEditorIds.has(editorId)) {
        controller.abort();
        networkControllersRef.current.delete(editorId);
      }
    }
  }, [panes]);

  useEffect(() => {
    return () => {
      for (const controller of networkControllersRef.current.values()) {
        controller.abort();
      }
      networkControllersRef.current.clear();
    };
  }, []);

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

  const runEditorStateBSearch = useCallback(
    async (pane: MemoSplitPaneState, editor: MemoSplitEditorState) => {
      const memo = editor.memoId ? memoById.get(editor.memoId) : null;
      const queryText = (editor.draftText ?? memo?.content ?? '').trim();
      const targetEditor =
        editor.view === 'network'
          ? editor
          : createEditor('network', { memoId: editor.memoId });

      if (!queryText) {
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            networkErrorMessage:
              t(
                '내용이 있는 메모에서 주변 메모를 찾아 주세요.',
                'Add some content to this note before finding nearby notes.',
              ),
            networkIsLoading: false,
            networkResults: [],
            view: 'network',
          },
          true,
        );
        return;
      }

      await onBeforeNetworkSearch?.();

      const networkRequestId = `network-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const queryChunk: MemoChunk = {
        end: queryText.length,
        id: `query-${networkRequestId}`,
        index: 0,
        start: 0,
        text: queryText,
      };
      networkControllersRef.current.get(targetEditor.id)?.abort();
      const controller = new AbortController();
      networkControllersRef.current.set(targetEditor.id, controller);

      // networkResults는 비우지 않는다 — 재검색이면 기존 그래프를 그대로 두고
      // 작은 상태 표시만 얹었다가 새 결과로 교체한다.
      upsertEditorById(
        pane.id,
        targetEditor,
        {
          networkErrorMessage: null,
          networkIsLoading: true,
          networkQueryChunk: queryChunk,
          networkRequestId,
          view: 'network',
        },
        true,
      );

      try {
        const response = await searchStateB({
          limit: 8,
          minimumSimilarity: NETWORK_MIN_SIMILARITY,
          memoId: editor.memoId ?? null,
          queryText,
          signal: controller.signal,
        });

        if (networkControllersRef.current.get(targetEditor.id) !== controller) {
          return;
        }
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            networkErrorMessage: null,
            networkIsLoading: false,
            networkQueryChunk: response.queryChunk,
            networkRequestId,
            networkResults: response.results,
            view: 'network',
          },
          false,
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          networkControllersRef.current.get(targetEditor.id) !== controller
        ) {
          return;
        }
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            networkErrorMessage: formatNetworkSearchErrorMessage(error, {
              isOnline: navigator.onLine,
            }),
            networkIsLoading: false,
            networkRequestId,
            networkResults: [],
            view: 'network',
          },
          false,
        );
      } finally {
        if (networkControllersRef.current.get(targetEditor.id) === controller) {
          networkControllersRef.current.delete(targetEditor.id);
        }
      }
    },
    [memoById, onBeforeNetworkSearch, t, upsertEditorById],
  );

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
        // 마지막 탭을 닫으면 빈 노트를 만들지 않고 패널 자체를 닫는다.
        if (onClosePane) {
          onClosePane(pane.id);
          return;
        }

        const nextEditor = createEditor('memo');
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
      event: React.DragEvent<HTMLButtonElement>,
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

  const beginResizePane = (
    event: React.PointerEvent<HTMLDivElement>,
    leftPaneId: string,
    rightPaneId: string,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const containerWidth = container.getBoundingClientRect().width;
    const paneCount = Math.max(panes.length, 1);
    const leftStart = paneWidths[leftPaneId] ?? 100 / paneCount;
    const rightStart = paneWidths[rightPaneId] ?? 100 / paneCount;
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    let latestWidths = paneWidths;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaPercent =
        ((moveEvent.clientX - startX) / containerWidth) * 100;
      const combined = leftStart + rightStart;
      const minPercent = Math.min(
        (SPLIT_PANE_MIN_WIDTH_PX / containerWidth) * 100,
        combined / 2,
      );
      const nextLeft = clamp(
        leftStart + deltaPercent,
        minPercent,
        combined - minPercent,
      );
      const nextRight = combined - nextLeft;

      latestWidths = {
        ...latestWidths,
        [leftPaneId]: nextLeft,
        [rightPaneId]: nextRight,
      };
      setPaneWidths(latestWidths);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onPointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      onPaneWidthsChange?.(latestWidths);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onPointerUp);
  };

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
          <span className="highlight-label">{t('관련 문장', 'Related sentence')}</span>
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
          <h4>{t('출처가 없습니다', 'No source selected')}</h4>
          <p>{t('추천 결과를 클릭하면 요약 텍스트를 볼 수 있습니다.', 'Select a recommendation to view its summary.')}</p>
        </div>
      );
    }

    // 저장된 수집 항목을 찾으면 전체 요약 상세(키워드/썸네일/요약·상세 토글)를
    // 보여준다. 못 찾으면(과거 세션의 탭, 메모 청크) 기존 축약 뷰로 폴백.
    const inboxItem = result.inboxSessionId
      ? inboxItems.find((candidate) => candidate.id === result.inboxSessionId)
      : null;
    if (inboxItem) {
      return (
        <SourceDetailPane
          item={inboxItem}
          onRetrySummary={onRetryInboxSummary}
        />
      );
    }

    return (
      <div className="source-pane-content">
        <span className="source-kind">{getSourceLabel(result, language)}</span>
        <h3 className="source-title">
          {result.title ?? result.sourceLabel ?? t('저장한 링크', 'Saved link')}
        </h3>
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
          <h5>{t('추천에 사용된 요약', 'Summary used for this recommendation')}</h5>
          <p>{result.chunkText || t('요약이 없습니다.', 'No summary is available.')}</p>
        </div>
      </div>
    );
  };

  const renderPaneBody = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
  ) => {
    if (editor.isViewPicker) {
      return (
        <div className="split-view-picker-stage">
          <section
            aria-label={t('새 탭에서 열기', 'Open in a new tab')}
            className="split-view-picker-panel"
          >
            <h2 className="split-view-picker-title">{t('새 탭에서 열기', 'Open in a new tab')}</h2>
            <div className="split-view-picker">
              {MENU_VIEWS.map((view, index) => {
                const ViewIcon = VIEW_ICONS[view];
                return (
                  <button
                    autoFocus={index === 0}
                    className="split-view-picker-item"
                    key={view}
                    onClick={() => handleSelectEditorView(pane, view)}
                    type="button"
                  >
                    {ViewIcon ? <ViewIcon size={18} /> : null}
                    <span>{viewLabel(view, language)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      );
    }

    if (editor.view === 'calendar') {
      return (
        <CalendarWorkspace
          blocks={calendarBlocks}
          categories={calendarCategories}
          isScheduleInboxOpen={isScheduleInboxPanelOpen}
          hasNewReport={hasNewReport}
          onCreateCategory={onCreateCalendarCategory}
          onDeleteCategory={onDeleteCalendarCategory}
          onDeleteBlock={onDeleteCalendarBlock}
          onDeleteScheduleSuggestion={onDeleteScheduleInbox}
          onDropScheduleInbox={onDropScheduleInbox}
          onPlaceScheduleSuggestion={onPlaceScheduleSuggestion}
          onSaveBlock={onSaveCalendarBlock}
          onToggleScheduleInbox={onToggleScheduleInboxPanel}
          onOpenReport={onOpenReport}
          onToggleCompleted={onToggleCalendarBlockCompleted}
          scheduleSuggestions={scheduleSuggestions}
        />
      );
    }

    if (editor.view === 'briefing') {
      return (
        <ScheduleInboxWorkspace
          inboxItems={scheduleInbox}
          onDeleteInbox={onDeleteScheduleInbox}
          onPlaceInbox={onPlaceScheduleInbox}
        />
      );
    }

    if (editor.view === 'inbox') {
      return (
        <InboxWorkspace
          inboxItems={inboxItems}
          isLoading={isInboxLoading}
          onDelete={onDeleteInboxItem}
          onOpenDetail={(item) =>
            onOpenPreview?.([inboxSessionToSourceResult(item)])
          }
          onSaveUrl={onSaveInboxUrl}
          onToggleLike={onToggleInboxLike}
        />
      );
    }

    if (
      editor.view === 'network' &&
      (editor.networkIsLoading ||
        editor.networkErrorMessage ||
        editor.networkQueryChunk ||
        editor.networkResults)
    ) {
      if (
        editor.networkIsLoading ||
        editor.networkErrorMessage ||
        editor.networkQueryChunk ||
        editor.networkResults
      ) {
        const isNetworkEmpty =
          !editor.networkIsLoading &&
          !editor.networkErrorMessage &&
          Boolean(editor.networkQueryChunk) &&
          editor.networkResults?.length === 0;
        // KNN local search view — radial ego-graph of the cursor sentence.
        const graph = buildSplitKnnGraph(
          editor.networkResults ?? [],
          (result) => getResultTitle(result, memos, language),
          language,
        );
        // 그래프를 보면서 노드를 훑는 맥락이라 참조다. 새 탭으로 열면
        // 기준이 됐던 그래프가 사라져 비교가 불가능해진다.
        const openResult = (result: NetworkSearchResult) => {
          if (result.memoId) {
            onSelectMemoById(result.memoId);
          }
          onOpenPreview?.([result], 'detail', {});
        };

        return (
          <div className="split-network-search net-graph-view">
            <div className="net-overlay-stack">
              {editor.networkErrorMessage && (
                <div className="network-inline-error net-inline-error">
                  <p className="form-error">{editor.networkErrorMessage}</p>
                  {isNetworkSearchRetryableMessage(
                    editor.networkErrorMessage,
                  ) && (
                    <button
                      className="quick-date-chip"
                      onClick={() => void runEditorStateBSearch(pane, editor)}
                      type="button"
                    >
                      {t('다시 시도', 'Try again')}
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* 결과 노드 수도 위치도 정해져 있지 않아 카드 스켈레톤을 쓸 수
                없다. 대신 그래프 영역 한가운데에 중심 원 하나와 옅은 점 몇
                개를 놓고, 문구는 1.2초가 지나야 CSS로 드러난다. 이미 그래프가
                있으면(재검색) 그래프를 지우지 않고 작은 표시만 얹는다. */}
            {editor.networkIsLoading &&
              (editor.networkResults && editor.networkResults.length > 0 ? (
                <span className="net-search-pip" role="status">
                  <span aria-hidden="true" className="inline-busy" />
                  <span className="net-search-pip-label">
                    {t('주변 메모 찾는 중', 'Finding nearby notes')}
                  </span>
                </span>
              ) : (
                <div
                  aria-live="polite"
                  className="net-search-bloom"
                  role="status"
                >
                  <SubnotaScatterMark />
                </div>
              ))}
            {isNetworkEmpty && (
              <EmptyState
                className="net-empty-state"
                size="canvas"
                title={t(
                  '연결된 메모나 저장한 링크가 아직은 없네요!',
                  'No related notes or saved links yet.',
                )}
                tone="start"
              />
            )}
            {editor.networkResults && editor.networkResults.length > 0 && (
              <>
                <KnowledgeGraphView
                  ariaLabel={t(
                    '현재 메모 기준 주변 메모와 링크의 유사도 맵',
                    'Similarity map of nearby notes and links for the current note',
                  )}
                  className="net-graph-canvas"
                  edges={graph.edges}
                  getNodeTooltip={(nodeId) => {
                    if (
                      !nodeId.startsWith('network:') ||
                      nodeId === 'network:query'
                    ) {
                      return null;
                    }
                    const chunkId = nodeId.slice('network:'.length);
                    const result = editor.networkResults?.find(
                      (item) => item.chunkId === chunkId,
                    );
                    return result
                      ? `${getResultTitle(result, memos, language)} · ${t('유사도', 'Similarity')} ${Math.round(result.similarity * 100)}%`
                      : null;
                  }}
                  nodes={graph.nodes}
                  showActiveNodeControl={false}
                  onSelectNode={(nodeId) => {
                    if (
                      !nodeId.startsWith('network:') ||
                      nodeId === 'network:query'
                    ) {
                      return;
                    }
                    const chunkId = nodeId.slice('network:'.length);
                    const result = editor.networkResults?.find(
                      (item) => item.chunkId === chunkId,
                    );
                    if (result) {
                      openResult(result);
                    }
                  }}
                />
              </>
            )}
          </div>
        );
      }
    }

    if (editor.view === 'topics' || editor.view === 'network') {
      // `network` fallback preserves previously persisted State A tabs.
      if (topicClusters.length > 0) {
        const activeTopicId =
          focusedTopicId ??
          topicMemberships.find(
            (membership) => membership.memoId === editor.memoId,
          )?.topicId ??
          null;
        const graph = buildSplitTopicGraph(
          topicClusters,
          topicMemberships,
          topicGlobalEdges,
          memos,
          editor.memoId,
          topicInboxMemberships,
          topicInboxEdges,
          inboxItems,
          language,
        );

        return (
          <div className="split-global-network split-topics-stage">
            <div className="split-topics-stage-title">
              Topics
              {isTopicsLoading && <TopicsBusyDot language={language} />}
            </div>
            {formatTopicUpdatedAt(topicUpdatedAt) && (
              <span
                className="split-topics-stage-updated-at"
                title={t(
                  'Topics 데이터가 마지막으로 갱신된 시간',
                  'Time Topics data was last updated',
                )}
              >
                {t('마지막 업데이트', 'Last updated')} ·{' '}
                {formatTopicUpdatedAt(topicUpdatedAt)}
              </span>
            )}
            <KnowledgeGraphView
              activeNodeId={
                focusedMemoId
                  ? `memo:${focusedMemoId}`
                  : topicFocusId
                    ? `topic:${topicFocusId}`
                    : activeTopicId
                      ? `topic:${activeTopicId}`
                      : null
              }
              ariaLabel={t('토픽 지식 그래프', 'Topic knowledge graph')}
              className="split-knowledge-graph"
              edges={graph.edges}
              focusedTopicId={topicFocusId}
              layout="force"
              nodes={graph.nodes}
              showActiveNodeControl={false}
              onSelectNode={(nodeId) => {
                if (nodeId.startsWith('topic:')) {
                  const topicId = nodeId.slice('topic:'.length);
                  setTopicFocusId((current) =>
                    current === topicId ? null : topicId,
                  );
                  setFocusedMemoId(null);
                  showTopicFolderFromGraph(topicId);
                  return;
                }

                if (nodeId.startsWith('inbox:')) {
                  const sessionId = nodeId.slice('inbox:'.length);
                  const item = inboxItems.find(
                    (candidate) => candidate.id === sessionId,
                  );
                  if (item) {
                    // Topics 그래프를 훑는 중이므로 참조로 연다.
                    onOpenPreview?.([inboxSessionToSourceResult(item)]);
                  }
                  return;
                }

                if (nodeId.startsWith('memo:')) {
                  const memoId = nodeId.slice('memo:'.length);
                  const topicId =
                    topicMemberships.find(
                      (membership) => membership.memoId === memoId,
                    )?.topicId ?? null;

                  if (topicId) {
                    // The graph selection is also the sidebar selection. This
                    // updates activeMemoId so the first clicked memo does not
                    // remain highlighted after selecting another node, while
                    // keeping the current editor tab unchanged.
                    onSelectMemoById(memoId);
                    showTopicFolderFromGraph(topicId, memoId);
                  }
                }
              }}
            />
          </div>
        );
      }

      // No backend topic clusters yet → fall back to a local category grouping
      // so the tab is still useful offline / before the nightly topic batch.
      // 계산이 오래 걸려도 이 폴백은 계속 보여준다 — 갱신 중이라는 사실은
      // 제목 옆 작은 점 하나로 충분하다.
      const fallbackCategories = Array.from(
        new Set(memos.map((memo) => getMemoCategory(memo.category))),
      );

      // 보여 줄 것이 정말 아무것도 없을 때만 콘텐츠 영역에 자리표시자를 둔다.
      if (isTopicsLoading && fallbackCategories.length === 0) {
        return (
          <div className="split-global-network split-topics-stage">
            <div className="split-topics-stage-title">
              Topics
              <TopicsBusyDot language={language} />
            </div>
            <div aria-hidden="true" className="split-topics-placeholder">
              {[0, 1, 2].map((index) => (
                <Skeleton
                  className="subnota-skeleton split-topics-placeholder-chip"
                  height={22}
                  key={index}
                  radius="xl"
                />
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className="split-global-network">
          <h4>
            Topics
            {isTopicsLoading && <TopicsBusyDot language={language} />}
          </h4>
          {fallbackCategories.length > 0 ? (
            <>
              <p>{t('카테고리 기반 임시 묶음', 'Temporary groups based on categories')}</p>
              <div className="split-topic-list">
                {fallbackCategories.map((category) => (
                  <button
                    key={category}
                    className="split-topic-chip"
                    onClick={() => {
                      const target = memos.find(
                        (memo) => getMemoCategory(memo.category) === category,
                      );
                      if (target) {
                        // 클러스터 맥락을 유지해야 하므로 참조로 연다.
                        onSelectMemoById(target.id);
                        onOpenPreview?.([memoToPreviewResult(target)]);
                      }
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
              {/* "야간 토픽 배치"는 내부 사정이다. 사용자가 알아야 할 것은
                  지금 보고 있는 게 임시 묶음이고 곧 바뀐다는 것뿐이다. */}
              <EmptyState
                size="inline"
                title={t(
                  '메모가 쌓이면 주제별로 자동으로 묶입니다',
                  'Notes are grouped by topic as they accumulate.',
                )}
              />
            </>
          ) : (
            /* 묶을 것이 하나도 없으면 "임시 묶음" 설명도 할 말이 없다.
               빈 상태 두 개를 쌓는 대신 마크를 단 하나로 합친다 — 링크
               저장함의 첫 사용 화면과 같은 형태다. */
            <EmptyState
              body={t('비슷한 내용끼리 저절로 모입니다.', 'Similar notes will gather here automatically.')}
              title={t(
                '메모가 쌓이면 주제별로 자동으로 묶입니다',
                'Notes are grouped by topic as they accumulate.',
              )}
              tone="start"
            />
          )}
        </div>
      );
    }

    if (editor.view === 'source') {
      return renderSourceBody(editor.sourceResult);
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
    // 계속 흔들지 않는다. 실제로 조치가 필요한 실패만 같은 자리에서 알린다.
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
          {showSaveIssue && (
            <span
              aria-label={savePresentation?.label}
              className="split-note-save-status"
              title={savePresentation?.label}
            >
              {savePresentation?.text}
            </span>
          )}
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
            <div
              className="split-note-menu-anchor"
              ref={isNoteMenuOpen ? setNoteMenuButtonEl : undefined}
            >
              <TooltipIconButton
                className={`split-action-btn split-note-menu-btn ${isNoteMenuOpen ? 'active' : ''}`}
                onClick={() => {
                  setNoteMenuFeedback(null);
                  setOpenNoteMenuEditorId((current) =>
                    current === editor.id ? null : editor.id,
                  );
                }}
                tooltip={t('노트 메뉴', 'Note menu')}
              >
                <MoreHorizontal size={18} />
              </TooltipIconButton>
              {isNoteMenuOpen && (
                <div
                  className="split-pane-menu-dropdown split-note-menu-dropdown"
                  ref={setNoteMenuDropdownEl}
                >
                  {/* 목록 행의 구름 배지를 없앤 자리. 동기화 상태는 여기서만
                      알린다 — 구름은 "클라우드에 있다"일 때만 붙인다. */}
                  <div className="split-menu-title-row split-menu-sync-row">
                    {memo?.local_sync_status === 'synced' ? (
                      <Cloud aria-hidden="true" size={15} />
                    ) : (
                      // 구름이 없는 상태에서도 문구가 아래 항목들과 같은 줄에
                      // 서도록 아이콘 자리를 비워 둔다.
                      <span
                        aria-hidden="true"
                        className="split-menu-title-slot"
                      />
                    )}
                    <span className="split-menu-title-label">
                      {savePresentation?.label ??
                        t('아직 저장되지 않은 새 노트', 'New note not yet saved')}
                    </span>
                    {memo?.local_sync_status === 'failed' &&
                      onRetryMemoSync && (
                        <button
                          aria-label={t('메모 동기화 재시도', 'Retry note sync')}
                          className="split-menu-retry"
                          disabled={isMemoSyncRetrying}
                          onClick={() => onRetryMemoSync(memo.id)}
                          type="button"
                        >
                          {isMemoSyncRetrying
                            ? t('동기화 중...', 'Syncing...')
                            : t('재시도', 'Retry')}
                        </button>
                      )}
                  </div>
                  {noteMenuFeedback && (
                    <div
                      className={`split-menu-feedback ${noteMenuFeedback.tone}`}
                      role="status"
                    >
                      {noteMenuFeedback.message}
                    </div>
                  )}
                  <div className="split-menu-separator" />
                  <button
                    className="split-menu-item"
                    disabled={!memo || !onTogglePinMemo}
                    onClick={() => {
                      if (memo) {
                        onTogglePinMemo?.(memo.id);
                      }
                      setOpenNoteMenuEditorId(null);
                    }}
                    type="button"
                  >
                    {memo && pinnedMemoIds.includes(memo.id) ? (
                      <PinSolid size={15} />
                    ) : (
                      <Pin size={15} />
                    )}
                    <span>
                      {memo && pinnedMemoIds.includes(memo.id)
                        ? t('메모 고정 해제', 'Unpin note')
                        : t('메모 고정', 'Pin note')}
                    </span>
                  </button>
                  <button
                    className="split-menu-item"
                    onClick={async () => {
                      const copied = await copyTextToClipboard(value);
                      setNoteMenuFeedback(
                        copied
                          ? {
                              message: t('Markdown을 복사했습니다.', 'Markdown copied.'),
                              tone: 'success',
                            }
                          : {
                              message: t('Markdown을 복사하지 못했습니다.', 'Could not copy Markdown.'),
                              tone: 'error',
                            },
                      );
                    }}
                    type="button"
                  >
                    <ClipboardCopy size={15} />
                    <span>{t('Markdown 복사', 'Copy Markdown')}</span>
                  </button>
                  <button
                    className="split-menu-item"
                    onClick={async () => {
                      try {
                        const filePath =
                          await window.electronAPI.exportMarkdown(
                            noteTitle.trim() || t('제목 없음', 'Untitled note'),
                            value,
                          );
                        if (filePath) {
                          setNoteMenuFeedback({
                            message: t('Markdown을 내보냈습니다.', 'Markdown exported.'),
                            tone: 'success',
                          });
                        } else {
                          setOpenNoteMenuEditorId(null);
                        }
                      } catch {
                        setNoteMenuFeedback({
                          message: t('Markdown을 내보내지 못했습니다.', 'Could not export Markdown.'),
                          tone: 'error',
                        });
                      }
                    }}
                    type="button"
                  >
                    <Download size={15} />
                    <span>{t('Markdown 내보내기', 'Export Markdown')}</span>
                  </button>
                  <button
                    className="split-menu-item"
                    disabled={!value.trim()}
                    onClick={() => {
                      const duplicated = onCreateMemo(
                        value,
                        memo?.category ?? editor.draftCategory,
                      );
                      openMemoInPane(pane.id, duplicated);
                      setOpenNoteMenuEditorId(null);
                    }}
                    type="button"
                  >
                    <Copy size={15} />
                    <span>{t('복제', 'Duplicate')}</span>
                  </button>
                  <div className="split-menu-separator" />
                  <button
                    className="split-menu-item split-menu-item-danger"
                    disabled={!memo || !onDeleteMemoById}
                    onClick={() => {
                      if (
                        memo &&
                        window.confirm(t('노트를 삭제하시겠습니까?', 'Delete this note?'))
                      ) {
                        onDeleteMemoById?.(memo.id);
                        handleCloseEditor(pane, editor.id);
                      }
                      setOpenNoteMenuEditorId(null);
                    }}
                    type="button"
                  >
                    <Trash2 size={15} />
                    <span>{t('삭제', 'Delete')}</span>
                  </button>
                </div>
              )}
            </div>
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
          {openDatePickerEditorId === editor.id ? (
            <div className="date-schedule-floating split-date-schedule-floating">
              <DateSchedulePopover
                confirmLabel={t('등록', 'Add')}
                initialDate={datePickerSeed ?? undefined}
                onApplyDate={(date, allDay) =>
                  applyEditorDate(editor, date, allDay)
                }
                onClose={() => {
                  // 피커만 닫는다 — scheduleConfirm이 있으면 확인 바로 복귀.
                  setOpenDatePickerEditorId(null);
                  setDatePickerSeed(null);
                }}
              />
            </div>
          ) : scheduleConfirm?.editorId === editor.id &&
            typeof document !== 'undefined' ? (
            createPortal(
              <div
                className="schedule-confirm-floating"
                style={{
                  left:
                    scheduleConfirm.anchor.left +
                    scheduleConfirm.anchor.width / 2,
                  top: scheduleConfirm.anchor.top - 6,
                }}
              >
                <ScheduleConfirmPopover
                  label={scheduleConfirm.label}
                  onChangeDate={() => openPickerFromConfirm(editor)}
                  onClose={() => setScheduleConfirm(null)}
                  onConfirm={() => commitScheduleConfirm(editor)}
                />
              </div>,
              document.body,
            )
          ) : null}
        </div>
        {renderHighlight(pane, editor, value)}
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
      <div
        className={`split-workspace-commandbar ${
          isSessionCollapsed ? 'session-collapsed' : ''
        }`}
      >
        {onToggleSession && (
          <TooltipIconButton
            className="split-command-button session-toggle-button"
            onClick={onToggleSession}
            tooltip={formatHotkeyTooltip(
              isSessionCollapsed
                ? t('사이드바 열기', 'Show sidebar')
                : t('사이드바 접기', 'Hide sidebar'),
              appShortcuts?.toggleSidebar,
            )}
          >
            {isSessionCollapsed ? (
              <PanelLeft size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </TooltipIconButton>
        )}
        {onOpenGlobalSearch && (
          <TooltipIconButton
            aria-label={t('전역 검색', 'Global search')}
            className="split-command-button global-search-trigger"
            onClick={onOpenGlobalSearch}
            tooltip={formatHotkeyTooltip(t('전역 검색', 'Global search'), searchShortcut)}
          >
            <Search size={16} />
          </TooltipIconButton>
        )}
        {/* 접기·검색(사이드바)과 undo·redo(문서)는 성격이 달라 한 덩어리로
            읽히면 안 된다. */}
        <div aria-hidden className="split-command-divider" />
        <EditorContext.Provider value={{ editor: focusedToolbarEditor }}>
          <UndoRedoButton
            action="undo"
            aria-label={t('실행 취소', 'Undo')}
            tooltip={t('실행 취소', 'Undo')}
          />
          <UndoRedoButton
            action="redo"
            aria-label={t('다시 실행', 'Redo')}
            tooltip={t('다시 실행', 'Redo')}
          />
        </EditorContext.Provider>
        <div className="split-workspace-drag-spacer" />
        {/* 네트워크 검색·메모 고정은 노트 내부(툴바/⋯ 메뉴)로 이동했다.
            다크 모드 토글 복원 시 ThemeToggle을 이 자리에 되돌리면 된다. */}
      </div>
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
                <div className="split-pane-header">
                  <div aria-hidden className="split-pane-titlebar-drag" />
                  <div
                    className="split-editor-tabs-scroll"
                    onDragLeave={handleTabDragLeave}
                    onDragOver={(event) => handleTabDragOver(event, pane.id)}
                    onDrop={(event) =>
                      handleTabDrop(event, pane.id, editors.length)
                    }
                  >
                    <div className="split-editor-tabs">
                      {editors.map((editor) => {
                        const tabLabel = editor.isViewPicker
                          ? t('새 탭', 'New tab')
                          : editor.view === 'memo'
                            ? getMemoTabLabel(
                                editor.draftText ??
                                  (editor.memoId
                                    ? memoById.get(editor.memoId)?.content
                                    : '') ??
                                  '',
                                language,
                              )
                            : viewLabel(editor.view, language);

                        return (
                          <button
                            aria-label={tabLabel}
                            draggable
                            key={editor.id}
                            onDragEnd={clearTabDrag}
                            onDragStart={(event) =>
                              handleTabDragStart(event, pane.id, editor.id)
                            }
                            onDragOver={(event) => {
                              event.stopPropagation();
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              handleTabDragOver(event, pane.id, {
                                editorId: editor.id,
                                position:
                                  event.clientX > rect.left + rect.width / 2
                                    ? 'after'
                                    : 'before',
                              });
                            }}
                            onDrop={(event) => {
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              const editorIndex = editors.findIndex(
                                (candidate) => candidate.id === editor.id,
                              );
                              handleTabDrop(
                                event,
                                pane.id,
                                editorIndex +
                                  (event.clientX > rect.left + rect.width / 2
                                    ? 1
                                    : 0),
                              );
                            }}
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
                            className={`split-editor-tab ${editor.id === activeEditor.id ? 'active' : ''}${draggedTab?.editorId === editor.id && draggedTab.paneId === pane.id ? ' dragging' : ''}${dropTarget?.paneId === pane.id && dropTarget.editorId === editor.id ? ` drop-${dropTarget.position}` : ''}`}
                            title={tabLabel}
                          >
                            <span className="split-tab-label">{tabLabel}</span>
                            <Tooltip
                              label={formatHotkeyTooltip(
                                t('탭 닫기', 'Close tab'),
                                editor.id === activeEditor.id
                                  ? appShortcuts?.closeActiveTab
                                  : null,
                              )}
                              openDelay={300}
                              position="bottom"
                            >
                              <span
                                aria-label={t('탭 닫기', 'Close tab')}
                                className="split-tab-close"
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseEditor(pane, editor.id);
                                }}
                                onDragStart={(event) => event.preventDefault()}
                                onPointerDown={(event) =>
                                  event.stopPropagation()
                                }
                                role="button"
                              >
                                <X size={13} />
                              </span>
                            </Tooltip>
                          </button>
                        );
                      })}
                      {dropTarget?.paneId === pane.id &&
                        !dropTarget.editorId && (
                          <span
                            aria-hidden
                            className="split-tab-drop-indicator"
                          />
                        )}
                      <div
                        aria-hidden
                        className="split-editor-tabs-drag-spacer"
                      />
                    </div>
                  </div>
                  <TooltipIconButton
                    className="split-editor-tab-add"
                    onClick={() => handleAddEditor(pane)}
                    tooltip={formatHotkeyTooltip(
                      t('새 탭', 'New tab'),
                      appShortcuts?.createTab,
                    )}
                  >
                    <Plus size={15} />
                  </TooltipIconButton>
                  <div
                    className="split-pane-actions"
                    ref={isMenuOpen ? setMenuActionsEl : undefined}
                  >
                    <TooltipIconButton
                      onClick={onAddPane}
                      className="split-action-btn"
                      disabled={!canAddPane}
                      tooltip={
                        canAddPane
                          ? formatHotkeyTooltip(
                              t('두 패널로 나누기', 'Split into two panes'),
                              appShortcuts?.createSplitPane,
                            )
                          : t(
                              'split 패널은 최대 2개까지 열 수 있습니다',
                              'You can open up to two split panes.',
                            )
                      }
                    >
                      <Columns2 size={14} />
                    </TooltipIconButton>
                    <TooltipIconButton
                      onClick={() =>
                        setOpenMenuPaneId((current) =>
                          current === pane.id ? null : pane.id,
                        )
                      }
                      className={`split-action-btn ${isMenuOpen ? 'active' : ''}`}
                      tooltip={t('탭 메뉴', 'Tab menu')}
                    >
                      <ChevronDown size={15} />
                    </TooltipIconButton>
                    <TooltipIconButton
                      disabled={panes.length <= 1}
                      onClick={() =>
                        onClosePane ? onClosePane(pane.id) : onCloseAllPanes?.()
                      }
                      className="split-action-btn"
                      tooltip={
                        panes.length <= 1
                          ? t('마지막 패널은 닫을 수 없습니다', 'The last pane cannot be closed.')
                          : t('패널 닫기', 'Close pane')
                      }
                    >
                      ×
                    </TooltipIconButton>
                  </div>
                  {isMenuOpen && (
                    <div
                      className="split-pane-menu-dropdown"
                      ref={setMenuDropdownEl}
                    >
                      <div className="split-menu-title-row">{t('스택 탭', 'Stack tabs')}</div>
                      <button
                        className="split-menu-item split-menu-item-muted"
                        disabled
                        type="button"
                      >
                        {language === 'en'
                          ? `${editors.length} tab bookmarks...`
                          : `${editors.length}개의 탭 북마크...`}
                      </button>
                      <div className="split-menu-separator" />
                      <button
                        className="split-menu-item"
                        onClick={() => handleCloseAllEditors(pane)}
                        type="button"
                      >
                        {t('모두 닫기', 'Close all')}
                      </button>
                      <div className="split-menu-separator" />
                      {MENU_VIEWS.map((view) => {
                        const ViewIcon = VIEW_ICONS[view];
                        return (
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
                                <Check size={14} />
                              ) : null}
                            </span>
                            {ViewIcon ? <ViewIcon size={15} /> : null}
                            <span>{viewLabel(view, language)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
