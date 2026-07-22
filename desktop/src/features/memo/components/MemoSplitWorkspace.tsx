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
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCopy,
  Columns2,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Network,
  PanelLeft,
  PanelLeftClose,
  Pin,
  PinSolid,
  Plus,
  Search,
  Trash2,
  X,
} from '@/components/icons';
import { useClickOutside } from '@mantine/hooks';
import TooltipIconButton from '../../../components/TooltipIconButton';
import RenderErrorBoundary from '../../../components/RenderErrorBoundary';
import {
  MemoRow,
  CalendarBlockRow,
  BriefingRow,
  MemoSimilarityEdge,
  ScheduleInboxRow,
  TopicCluster,
  TopicInboxMembership,
  TopicMemoInboxEdge,
  TopicMembership,
} from '../../../types';
import { InboxSession } from '../../../services/backend/inboxService';
import { MemoChunk, getCursorContextText } from '../../../lib/memoChunker';
import {
  NETWORK_SEARCH_EMPTY_MESSAGE,
  NetworkSearchResult,
  formatNetworkSearchErrorMessage,
  isNetworkSearchRetryableMessage,
  searchCursorNetwork,
} from '../../../services/backend/networkService';
import { NETWORK_MIN_SIMILARITY } from '../../../lib/constants';
import { EditorContext } from '@tiptap/react';
import { UndoRedoButton } from '../../../components/tiptap-ui/undo-redo-button/undo-redo-button';
import {
  NoteFixedToolbar,
  SimpleEditor,
} from '../../../components/tiptap-templates/simple/simple-editor';
import CalendarWorkspace, { CalendarTreePanel } from '../../calendar/CalendarWorkspace';
import BriefingWorkspace from '../../briefing/BriefingWorkspace';
import InboxWorkspace from '../../inbox/InboxWorkspace';
import { getMemoCategory } from '../../../lib/memoCategory';
import {
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
  LINK_NODE_ICON,
  NOTE_NODE_ICON,
} from './knowledgeGraph';

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
  briefing: '일정 inbox',
  calendar: '캘린더',
  inbox: '웹 inbox',
  memo: '노트',
  network: '네트워크 검색',
  source: '웹 요약',
  topics: 'Topics',
};

const MENU_VIEWS: MemoSplitPaneView[] = [
  'memo',
  'inbox',
  'calendar',
  'briefing',
  'topics',
];
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

const PaneBodyRenderer = ({ render }: { render: () => React.ReactNode }) => (
  <>{render()}</>
);

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

const getGraphMemoTitle = (memo: MemoRow, limit = 13) => {
  const title =
    memo.content
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) ?? '제목 없는 노트';

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
) => {
  // Center "지금 문장" node is the cursor sentence; neighbour nodes orbit it,
  // pulled closer the higher their similarity. Labels are memo titles so the
  // graph reads like the network mock.
  const nodes: KnowledgeGraphNode[] = [
    {
      color: '#1d1d1f',
      id: 'network:query',
      label: '지금 문장',
      size: 15,
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
      color: result.sourceKind === 'inbox' ? '#6d7185' : '#cc785c',
      id: nodeId,
      image: result.sourceKind === 'inbox' ? LINK_NODE_ICON : NOTE_NODE_ICON,
      label: getLabel(result),
      size: clamp(7 + similarity * 9, 8, 17),
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

const getResultTitle = (result: NetworkSearchResult, memos: MemoRow[]) => {
  if (result.sourceKind === 'inbox') {
    return result.title || result.sourceLabel || '링크';
  }
  const memo = result.memoId ? memos.find(item => item.id === result.memoId) : null;
  const source = memo?.content ?? result.memoContent ?? result.chunkText ?? '';
  const firstLine = source
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return '제목 없는 노트';
  }
  return firstLine.length > 22 ? `${firstLine.slice(0, 22).trimEnd()}…` : firstLine;
};

const formatResultDate = (timestamp: number | null) =>
  timestamp ? format(new Date(timestamp), 'M월 d일') : '';

const getGraphInboxTitle = (item: InboxSession, limit = 13) => {
  const title = item.title ?? item.domain ?? '저장한 링크';
  return title.length > limit ? `${title.slice(0, limit).trimEnd()}...` : title;
};

// Shape a saved inbox summary like a network result so the shared source view
// (renderSourceBody / openSourceInPane) can display it.
const inboxSessionToSourceResult = (item: InboxSession): NetworkSearchResult => ({
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

const buildSplitTopicGraph = (
  clusters: TopicCluster[],
  memberships: TopicMembership[],
  globalEdges: MemoSimilarityEdge[],
  memos: MemoRow[],
  activeMemoId: string | null,
  focusedTopicId: string | null,
  inboxMemberships: TopicInboxMembership[] = [],
  inboxEdges: TopicMemoInboxEdge[] = [],
  inboxItems: InboxSession[] = [],
) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));
  const inboxItemById = new Map(inboxItems.map(item => [item.id, item]));
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  // Filter ONLY on an explicit topic focus. Falling back to the active memo's
  // topic silently dropped every other cluster's memo-memo edges (the panel
  // Topics view looked like bare hub-spoke stars while the rail view didn't).
  const activeTopicId = focusedTopicId ?? null;
  const total = Math.max(clusters.length, 1);
  // Push clusters onto a wider ring as their count grows so they don't overlap.
  const topicRing = 1.4 + total * 0.18;
  // Per-cluster color by index → the first 8 clusters are always distinct.
  const topicColor = new Map(
    clusters.map((cluster, index) => [cluster.id, TOPIC_COLORS[index % TOPIC_COLORS.length]]),
  );
  const colorOf = (id: string | null | undefined) => (id && topicColor.get(id)) || TOPIC_COLORS[0];

  clusters.forEach((cluster, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const topicMemberships = memberships.filter(item => item.topicId === cluster.id);
    const isActiveLinked = Boolean(
      activeMemoId && topicMemberships.some(item => item.memoId === activeMemoId),
    );
    const count = Math.max(cluster.memoCount, topicMemberships.length, isActiveLinked ? 1 : 0);
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
      .map(membership => ({
        memo: memoById.get(membership.memoId),
        score: membership.score ?? 0.5,
      }))
      .filter((row): row is { memo: MemoRow; score: number } => Boolean(row.memo))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOPIC_GRAPH_MEMO_NODE_LIMIT)
      .forEach(({ memo, score }, memoIndex, memoRows) => {
        const memoAngle = (Math.PI * 2 * memoIndex) / Math.max(memoRows.length, 1);
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
          label: getGraphMemoTitle(memo),
          memoId: memo.id,
          size: clamp(4.5 + score * 4 + (memo.id === activeMemoId ? 2 : 0), 5, 10),
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
      .filter(membership => membership.topicId === cluster.id)
      .map(membership => ({
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
          label: getGraphInboxTitle(item),
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
  const visibleGlobalEdges = activeTopicId
    ? simplifiedGlobalEdges.filter(
        edge =>
          edge.sourceTopicId === activeTopicId &&
          edge.targetTopicId === activeTopicId,
      )
    : capCrossTopicBridges(simplifiedGlobalEdges, TOPIC_BRIDGE_EDGE_LIMIT);

  visibleGlobalEdges
    .forEach((edge, index) => {
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

  inboxEdges
    .filter(edge => !activeTopicId || edge.topicId === activeTopicId)
    .forEach((edge, index) => {
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
  ambientEditorId?: string | null;
  ambientEmptyEditorId?: string | null;
  ambientError?: string | null;
  ambientPendingEditorId?: string | null;
  ambientResult?: NetworkSearchResult | null;
  ambientSearchingEditorId?: string | null;
  onRunAmbientSearch?: () => void;
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
  onAmbientQuery?: (editorId: string, memoId: string | null, queryText: string) => void;
  panes: MemoSplitPaneState[];
  memos: MemoRow[];
  onCreateMemo: (content: string, category?: string) => MemoRow;
  onDeleteMemoById?: (memoId: string) => void;
  onUpdateMemo: (id: string, content: string) => void;
  onSelectMemoById: (memoId: string) => void;
  
  // 캘린더 연동
  calendarBlocks: CalendarBlockRow[];
  onDeleteCalendarBlock: (id: string) => void;
  onSaveCalendarBlock: (draft: any) => Promise<void>;
  onToggleCalendarBlockCompleted: (id: string) => void;
  calendarTreePanel: CalendarTreePanel | null;

  // 수집함 연동
  inboxItems: any[];
  isInboxLoading: boolean;
  onDeleteInboxItem: (id: string) => void;
  onRefreshInbox: () => void;
  onSaveInboxUrl: (url: string) => Promise<void>;
  onToggleInboxLike: (id: string, liked: boolean) => void;

  // 브리핑 연동
  briefings: BriefingRow[];
  scheduleInbox: ScheduleInboxRow[];
  onAcceptInbox: (item: ScheduleInboxRow) => void;
  onDismissInbox: (item: ScheduleInboxRow) => void;

  // Topics 지도 데이터
  isTopicsLoading?: boolean;
  topicClusters: TopicCluster[];
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
  ambientSearchingEditorId = null,
  onRunAmbientSearch,
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
  onAmbientQuery,
  panes,
  memos,
  onCreateMemo,
  onDeleteMemoById,
  onUpdateMemo,
  onSelectMemoById,
  calendarBlocks,
  onDeleteCalendarBlock,
  onSaveCalendarBlock,
  onToggleCalendarBlockCompleted,
  calendarTreePanel,
  inboxItems,
  isInboxLoading,
  onDeleteInboxItem,
  onRefreshInbox,
  onSaveInboxUrl,
  onToggleInboxLike,
  briefings,
  scheduleInbox,
  onAcceptInbox,
  onDismissInbox,
  isTopicsLoading = false,
  topicClusters,
  topicInboxEdges = [],
  topicInboxMemberships = [],
  topicGlobalEdges,
  topicMemberships,
  onTogglePinMemo,
  pinnedMemoIds = [],
}: MemoSplitWorkspaceProps) => {
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
    editorId: string;
    date: Date;
    allDay: boolean;
    title: string;
    label: string;
  } | null>(null);
  const [openMenuPaneId, setOpenMenuPaneId] = useState<string | null>(null);
  // 스택 탭 드롭다운 외부 클릭 시 닫기. 토글 버튼이 있는 actions 줄은 제외해
  // "닫힘 → onClick 재오픈" 레이스를 막는다 (한 번에 하나만 열리므로 ref 한 쌍).
  const [menuDropdownEl, setMenuDropdownEl] = useState<HTMLDivElement | null>(null);
  const [menuActionsEl, setMenuActionsEl] = useState<HTMLDivElement | null>(null);
  useClickOutside(() => setOpenMenuPaneId(null), null, [
    menuDropdownEl,
    menuActionsEl,
  ]);
  // 노트 ⋯ 메뉴(노트 관리 전용). 패널 메뉴와 동일한 외부 클릭 닫기 패턴.
  const [openNoteMenuEditorId, setOpenNoteMenuEditorId] = useState<
    string | null
  >(null);
  const [noteMenuDropdownEl, setNoteMenuDropdownEl] =
    useState<HTMLDivElement | null>(null);
  const [noteMenuButtonEl, setNoteMenuButtonEl] =
    useState<HTMLDivElement | null>(null);
  useClickOutside(() => setOpenNoteMenuEditorId(null), null, [
    noteMenuDropdownEl,
    noteMenuButtonEl,
  ]);
  const [focusedTopicId, setFocusedTopicId] = useState<string | null>(null);
  const [focusedMemoId, setFocusedMemoId] = useState<string | null>(null);
  const [editorInstances, setEditorInstances] = useState<
    Record<string, Editor | null>
  >({});
  const [paneWidths, setPaneWidths] = useState<Record<string, number>>(
    () => initialPaneWidths,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkControllersRef = useRef<Map<string, AbortController>>(new Map());
  const panesRef = useRef(panes);
  const paneIdsRef = useRef(panes.map(pane => pane.id).join('|'));

  useEffect(() => {
    const handleShowTopicFolder = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string; topicId?: string }>).detail;
      setFocusedTopicId(detail?.topicId ?? null);
      setFocusedMemoId(detail?.memoId ?? null);
    };

    window.addEventListener('subnota:show-topic-folder', handleShowTopicFolder);
    return () => window.removeEventListener('subnota:show-topic-folder', handleShowTopicFolder);
  }, []);

  useEffect(() => {
    panesRef.current = panes;
  }, [panes]);

  useEffect(() => {
    const liveEditorIds = new Set(panes.flatMap(pane => getPaneEditors(pane).map(editor => editor.id)));
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
    const livePaneIds = new Set(panes.map(pane => pane.id));
    setEditorInstances(prev => {
      const entries = Object.entries(prev).filter(([id]) => livePaneIds.has(id));
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
      paneId: string,
      editorId: string,
      patch: Partial<MemoSplitEditorState>,
    ) => {
      const pane = panesRef.current.find(candidate => candidate.id === paneId);
      if (!pane) {
        return;
      }
      const editors = getPaneEditors(pane);
      const nextEditors = editors.map(editor =>
        editor.id === editorId ? { ...editor, ...patch } : editor,
      );
      const nextActiveEditor =
        nextEditors.find(editor => editor.id === pane.activeEditorId) ??
        nextEditors.find(editor => editor.id === editorId) ??
        nextEditors[0];

      onChangePane(paneId, {
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
      const pane = panesRef.current.find(candidate => candidate.id === paneId);
      if (!pane) {
        return;
      }

      const editors = getPaneEditors(pane);
      const nextEditor: MemoSplitEditorState = { ...editor, ...patch };
      const hasEditor = editors.some(candidate => candidate.id === editor.id);
      const nextEditors = hasEditor
        ? editors.map(candidate =>
            candidate.id === editor.id ? nextEditor : candidate,
          )
        : [...editors, nextEditor];
      const activeEditorId = activate
        ? nextEditor.id
        : pane.activeEditorId ?? nextEditor.id;
      const nextActiveEditor =
        nextEditors.find(candidate => candidate.id === activeEditorId) ??
        nextEditor;

      onChangePane(paneId, {
        ...mirrorEditorPatch(nextActiveEditor),
        activeEditorId: nextActiveEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const runEditorNetworkSearch = useCallback(
    async (pane: MemoSplitPaneState, editor: MemoSplitEditorState) => {
      const candidate = editorInstances[pane.id];
      const liveEditor = candidate && !candidate.isDestroyed ? candidate : null;
      const selection = liveEditor?.state.selection.$from;
      const savedQueryText = editor.networkQueryChunk?.text?.trim() ?? '';
      const shouldReuseSavedQuery = editor.view === 'network' && Boolean(savedQueryText);
      const paragraph = shouldReuseSavedQuery
        ? savedQueryText
        : selection?.parent.textContent ?? editor.ambientQueryText ?? '';
      // 앰비언트 검색과 동일하게 커서 문장 ±1로 쿼리한다. 문단 전체를 보내면
      // 한 문단짜리 노트가 통째로 한 블록으로 임베딩/표시되고(백엔드는 ~3문장
      // 청크를 인덱싱), 유사도도 떨어진다.
      const queryText = (shouldReuseSavedQuery
        ? paragraph
        : selection
        ? getCursorContextText(
            paragraph,
            Math.min(selection.parentOffset, paragraph.length),
          )
        : paragraph
      )
        .slice(0, 1000)
        .trim();
      const targetEditor =
        editor.view === 'network'
          ? editor
          : createEditor('network', { memoId: editor.memoId });

      if (!queryText) {
        upsertEditorById(pane.id, targetEditor, {
          networkErrorMessage: '검색할 문단을 먼저 선택하거나 작성해 주세요.',
          networkIsLoading: false,
          networkResults: [],
          view: 'network',
        }, true);
        return;
      }

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

      upsertEditorById(pane.id, targetEditor, {
        networkErrorMessage: null,
        networkIsLoading: true,
        networkQueryChunk: queryChunk,
        networkRequestId,
        networkResults: [],
        view: 'network',
      }, true);

      try {
        const response = await searchCursorNetwork({
          limit: 8,
          minimumSimilarity: NETWORK_MIN_SIMILARITY,
          memoId: editor.memoId ?? null,
          queryText,
          signal: controller.signal,
        });

        if (networkControllersRef.current.get(targetEditor.id) !== controller) {
          return;
        }
        upsertEditorById(pane.id, targetEditor, {
          networkErrorMessage:
            response.results.length === 0
              ? response.message ?? NETWORK_SEARCH_EMPTY_MESSAGE
              : null,
          networkIsLoading: false,
          networkQueryChunk: response.queryChunk,
          networkRequestId,
          networkResults: response.results,
          view: 'network',
        }, false);
      } catch (error) {
        if (
          controller.signal.aborted ||
          networkControllersRef.current.get(targetEditor.id) !== controller
        ) {
          return;
        }
        upsertEditorById(pane.id, targetEditor, {
          networkErrorMessage: formatNetworkSearchErrorMessage(error, {
            isOnline: navigator.onLine,
          }),
          networkIsLoading: false,
          networkRequestId,
          networkResults: [],
          view: 'network',
        }, false);
      } finally {
        if (networkControllersRef.current.get(targetEditor.id) === controller) {
          networkControllersRef.current.delete(targetEditor.id);
        }
      }
    },
    [editorInstances, upsertEditorById],
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
      const combined = leftStart + rightStart;
      const minPercent = Math.min(
        (SPLIT_PANE_MIN_WIDTH_PX / containerWidth) * 100,
        combined / 2,
      );
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
      const nextEditors = pane ? getPaneEditors(pane) : [];

      onSelectMemoById(memo.id);

      // Already open in this pane → focus that tab instead of a duplicate.
      const existingEditor = nextEditors.find(
        editor => editor.view === 'memo' && editor.memoId === memo.id,
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
      // 항상 새 탭으로 열고(활성 탭을 덮어쓰지 않음), 같은 수집 항목이 이미
      // 열려 있으면 그 탭을 포커스한다.
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

  // 토픽 폴더(사이드바)의 링크 행 클릭 → 해당 요약을 소스 탭으로 연다.
  useEffect(() => {
    const handleOpenInboxSource = (event: Event) => {
      const detail = (event as CustomEvent<{ inboxSessionId?: string }>).detail;
      const item = (inboxItems as InboxSession[]).find(
        candidate => candidate.id === detail?.inboxSessionId,
      );
      const pane = focusedPane ?? panes[0];
      if (item && pane) {
        openSourceInPane(pane, inboxSessionToSourceResult(item));
      }
    };

    window.addEventListener('subnota:open-inbox-source', handleOpenInboxSource);
    return () =>
      window.removeEventListener('subnota:open-inbox-source', handleOpenInboxSource);
  }, [focusedPane, inboxItems, openSourceInPane, panes]);

  // 캘린더 일정의 "원본 노트 열기" → 해당 노트를 포커스 패널 탭으로 연다.
  useEffect(() => {
    const handleOpenMemo = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string }>).detail;
      const memo = detail?.memoId ? memoById.get(detail.memoId) : null;
      const pane = focusedPane ?? panes[0];
      if (memo && pane) {
        openMemoInPane(pane.id, memo);
      }
    };

    window.addEventListener('subnota:open-memo', handleOpenMemo);
    return () => window.removeEventListener('subnota:open-memo', handleOpenMemo);
  }, [focusedPane, memoById, openMemoInPane, panes]);

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

    const schedule = buildScheduleFromSelection(selectedText);
    if (!schedule.date) {
      // 날짜 미인식 → 바로 날짜 피커를 띄워 직접 고르게 한다.
      setScheduleConfirm(null);
      setDatePickerSeed(null);
      setOpenDatePickerEditorId(editor.id);
      return;
    }

    // 날짜 감지 → 저장 전에 감지 결과(숫자 날짜)를 확인 바로 보여준다.
    const time = formatTimeIfPresent(schedule.date);
    const label = time
      ? `${formatDisplayDate(schedule.date)} ${time}`
      : formatDisplayDate(schedule.date);
    setOpenDatePickerEditorId(null);
    setScheduleConfirm({
      editorId: editor.id,
      date: schedule.date,
      allDay: schedule.allDay,
      title: schedule.title,
      label,
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
    }).then(() => {
      window.alert('일정이 등록되었습니다.');
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
        title: buildScheduleFromSelection(selectedText).title,
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

    // 저장된 수집 항목을 찾으면 전체 요약 상세(키워드/썸네일/요약·상세 토글)를
    // 보여준다. 못 찾으면(과거 세션의 탭, 메모 청크) 기존 축약 뷰로 폴백.
    const inboxItem = result.inboxSessionId
      ? (inboxItems as InboxSession[]).find(
          candidate => candidate.id === result.inboxSessionId,
        )
      : null;
    if (inboxItem) {
      return <SourceDetailPane item={inboxItem} />;
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
          onToggleCompleted={onToggleCalendarBlockCompleted}
          treePanel={calendarTreePanel}
        />
      );
    }

    if (editor.view === 'briefing') {
      return (
        <BriefingWorkspace
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
          onDelete={onDeleteInboxItem}
          onOpenDetail={item =>
            openSourceInPane(pane, inboxSessionToSourceResult(item))
          }
          onRefresh={onRefreshInbox}
          onSaveUrl={onSaveInboxUrl}
          onToggleLike={onToggleInboxLike}
        />
      );
    }

    if (
      editor.view === 'network' &&
      (
        editor.networkIsLoading ||
        editor.networkErrorMessage ||
        editor.networkQueryChunk ||
        editor.networkResults
      )
    ) {
      if (
        editor.networkIsLoading ||
        editor.networkErrorMessage ||
        editor.networkQueryChunk ||
        editor.networkResults
      ) {
        // KNN local search view — radial ego-graph of the cursor sentence.
        const graph = buildSplitKnnGraph(editor.networkResults ?? [], result =>
          getResultTitle(result, memos),
        );
        const openResult = (result: NetworkSearchResult) => {
          const target = result.memoId
            ? memos.find(item => item.id === result.memoId)
            : null;
          if (target) {
            onSelectMemoById(target.id);
            openMemoInPane(pane.id, target);
          } else if (result.sourceKind === 'inbox') {
            openSourceInPane(pane, result);
          }
        };

        return (
          <div className="split-network-search net-graph-view">
            <div className="net-overlay-stack">
              <div className="net-query-card">
                <span className="net-query-eyebrow">지금 문장</span>
                <p className="net-query-text">
                  {editor.networkQueryChunk?.text?.trim() ||
                    '문장을 선택하거나 작성해 주세요.'}
                </p>
              </div>
              {editor.networkErrorMessage && (
                <div className="network-inline-error net-inline-error">
                  <p className="form-error">{editor.networkErrorMessage}</p>
                  {isNetworkSearchRetryableMessage(editor.networkErrorMessage) && (
                    <button
                      className="quick-date-chip"
                      onClick={() => void runEditorNetworkSearch(pane, editor)}
                      type="button"
                    >
                      다시 시도
                    </button>
                  )}
                </div>
              )}
            </div>
            {editor.networkIsLoading && (
              <p className="loading-text net-loading">연결성 찾는 중...</p>
            )}
            {editor.networkResults && editor.networkResults.length > 0 && (
              <>
                <KnowledgeGraphView
                  ariaLabel="커서 문장 기준 유사 메모 그래프"
                  className="net-graph-canvas"
                  edges={graph.edges}
                  nodes={graph.nodes}
                  onSelectNode={nodeId => {
                    if (!nodeId.startsWith('network:') || nodeId === 'network:query') {
                      return;
                    }
                    const chunkId = nodeId.slice('network:'.length);
                    const result = editor.networkResults?.find(
                      item => item.chunkId === chunkId,
                    );
                    if (result) {
                      openResult(result);
                    }
                  }}
                />
                <div className="net-result-dock">
                  <div className="net-result-dock-head">
                    <strong>연결된 메모</strong>
                    <span>유사도 순 · {editor.networkResults.length}</span>
                  </div>
                  <div className="net-result-cards">
                    {editor.networkResults.map(res => (
                      <button
                        className="net-result-card"
                        key={res.chunkId}
                        onClick={() => openResult(res)}
                        type="button"
                      >
                        <span className="net-card-top">
                          <span className="net-card-dot" />
                          <strong className="net-card-title">
                            {getResultTitle(res, memos)}
                          </strong>
                          <span className="net-card-sim">
                            {Math.round(res.similarity * 100)}%
                          </span>
                        </span>
                        <span className="net-card-bottom">
                          <span className="net-card-date">
                            {formatResultDate(res.memoCreatedAt)}
                          </span>
                          <span className="net-card-open">
                            <ExternalLink size={12} />
                            새 탭으로 노트 열기
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
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
          topicMemberships.find(membership => membership.memoId === editor.memoId)?.topicId ?? null;
        const graph = buildSplitTopicGraph(
          topicClusters,
          topicMemberships,
          topicGlobalEdges,
          memos,
          editor.memoId,
          focusedTopicId,
          topicInboxMemberships,
          topicInboxEdges,
          inboxItems as InboxSession[],
        );

        return (
          <div className="split-global-network split-topics-stage">
            <div className="split-topics-stage-title">Topics</div>
            <KnowledgeGraphView
              activeNodeId={
                focusedMemoId
                  ? `memo:${focusedMemoId}`
                  : activeTopicId
                    ? `topic:${activeTopicId}`
                    : null
              }
              ariaLabel="토픽 지식 그래프"
              className="split-knowledge-graph"
              edges={graph.edges}
              layout="force"
              nodes={graph.nodes}
              onSelectNode={nodeId => {
                if (nodeId.startsWith('topic:')) {
                  const topicId = nodeId.slice('topic:'.length);
                  setFocusedMemoId(null);
                  if (focusedTopicId === topicId) {
                    // Second click on the focused hub returns to the full map.
                    setFocusedTopicId(null);
                  } else {
                    showTopicFolderFromGraph(topicId);
                  }
                  return;
                }

                if (nodeId.startsWith('inbox:')) {
                  const sessionId = nodeId.slice('inbox:'.length);
                  const item = (inboxItems as InboxSession[]).find(
                    candidate => candidate.id === sessionId,
                  );
                  if (item) {
                    openSourceInPane(pane, inboxSessionToSourceResult(item));
                  }
                  return;
                }

                if (nodeId.startsWith('memo:')) {
                  const memoId = nodeId.slice('memo:'.length);
                  const topicId =
                    topicMemberships.find(membership => membership.memoId === memoId)?.topicId ??
                    null;

                  if (topicId) {
                    showTopicFolderFromGraph(topicId, memoId);
                  }
                }
              }}
            />
          </div>
        );
      }

      // Clusters not here yet but a fetch is in flight → loading, not fallback.
      if (isTopicsLoading) {
        return (
          <div className="split-global-network split-topics-stage">
            <div className="split-topics-stage-title">Topics</div>
            <p className="loading-text">Topics 계산 결과를 불러오는 중...</p>
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
    const syncLabel =
      memo?.local_sync_status === 'synced'
        ? '클라우드에 동기화됨'
        : memo?.local_sync_status === 'failed'
          ? '로컬에 저장됨 · 동기화 실패'
          : '로컬에 저장됨';
    // 제목 = content 첫 줄(기존 파생 규칙). 본문 에디터에는 첫 줄을 제외한
    // 나머지만 넣고, 저장은 항상 join된 전체 content로 기존 경로를 탄다.
    const { body: noteBody, title: noteTitle } = splitNoteContent(value);
    const isNoteMenuOpen = openNoteMenuEditorId === editor.id;
    const liveEditor = resolveLiveEditor(pane.id);
    // 하단 보조 줄은 표시할 내용(날짜 인식·연관 문장 결과)이 있을 때만 그린다.
    const isAmbientTarget =
      pane.id === focusedPane?.id &&
      (editor.id === ambientEmptyEditorId ||
        (editor.id === ambientEditorId &&
          Boolean(ambientResult || ambientError)));

    return (
      <div className="split-memo-pane-body">
        <div className="split-note-header">
          <span
            aria-label={memo ? syncLabel : undefined}
            className="split-note-save-status"
            title={memo ? syncLabel : undefined}
          >
            {memo
              ? memo.local_sync_status === 'synced'
                ? '☁︎ 저장됨'
                : memo.local_sync_status === 'failed'
                  ? '! 저장됨 · 동기화 실패'
                  : '✓ 저장됨'
              : '새 노트'}
          </span>
          <div className="split-note-title-row">
            <input
              aria-label="노트 제목"
              className="split-note-title-input"
              onChange={event =>
                handleChangeMemoText(
                  pane,
                  editor,
                  joinNoteContent(event.target.value, noteBody),
                )
              }
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  resolveLiveEditor(pane.id)?.chain().focus('start').run();
                }
              }}
              placeholder="제목 없음"
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
                onClick={() =>
                  setOpenNoteMenuEditorId(current =>
                    current === editor.id ? null : editor.id,
                  )
                }
                tooltip="노트 메뉴"
              >
                <MoreHorizontal size={18} />
              </TooltipIconButton>
              {isNoteMenuOpen && (
                <div
                  className="split-pane-menu-dropdown split-note-menu-dropdown"
                  ref={setNoteMenuDropdownEl}
                >
                  <div className="split-menu-title-row">
                    {memo ? syncLabel : '아직 저장되지 않은 새 노트'}
                  </div>
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
                        ? '메모 고정 해제'
                        : '메모 고정'}
                    </span>
                  </button>
                  <button
                    className="split-menu-item"
                    onClick={() => {
                      void navigator.clipboard.writeText(value);
                      setOpenNoteMenuEditorId(null);
                    }}
                    type="button"
                  >
                    <ClipboardCopy size={15} />
                    <span>Markdown 복사</span>
                  </button>
                  <button
                    className="split-menu-item"
                    onClick={() => {
                      void window.electronAPI.exportMarkdown(
                        noteTitle.trim() || '제목 없음',
                        value,
                      );
                      setOpenNoteMenuEditorId(null);
                    }}
                    type="button"
                  >
                    <Download size={15} />
                    <span>Markdown 내보내기</span>
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
                    <span>복제</span>
                  </button>
                  <div className="split-menu-separator" />
                  <button
                    className="split-menu-item split-menu-item-danger"
                    disabled={!memo || !onDeleteMemoById}
                    onClick={() => {
                      if (
                        memo &&
                        window.confirm('노트를 삭제하시겠습니까?')
                      ) {
                        onDeleteMemoById?.(memo.id);
                        handleCloseEditor(pane, editor.id);
                      }
                      setOpenNoteMenuEditorId(null);
                    }}
                    type="button"
                  >
                    <Trash2 size={15} />
                    <span>삭제</span>
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
                setOpenDatePickerEditorId(current =>
                  current === editor.id ? null : editor.id,
                );
              }}
              tooltip="날짜 선택"
            >
              <CalendarDays size={15} />
            </TooltipIconButton>
            <TooltipIconButton
              aria-busy={editor.id === ambientSearchingEditorId || undefined}
              aria-label={
                editor.id === ambientSearchingEditorId
                  ? '연관 문장 검색 중'
                  : '연관 문장'
              }
              className="split-action-btn note-tool-btn ambient-search-button"
              disabled={
                editor.id === ambientSearchingEditorId ||
                editor.id !== ambientPendingEditorId
              }
              onClick={() => onRunAmbientSearch?.()}
              tooltip={
                editor.id === ambientSearchingEditorId
                  ? '연관 문장 검색 중'
                  : '연관 문장'
              }
            >
              {editor.id === ambientSearchingEditorId ? (
                <span aria-hidden className="ambient-search-spinner" />
              ) : (
                <Search size={15} />
              )}
            </TooltipIconButton>
            <TooltipIconButton
              className="split-action-btn note-tool-btn"
              onClick={() => void runEditorNetworkSearch(pane, editor)}
              tooltip="네트워크 검색"
            >
              <Network size={15} />
            </TooltipIconButton>
          </NoteFixedToolbar>
          {openDatePickerEditorId === editor.id ? (
            <div className="date-schedule-floating split-date-schedule-floating">
              <DateSchedulePopover
                confirmLabel="등록"
                initialDate={datePickerSeed ?? undefined}
                onApplyDate={(date, allDay) => applyEditorDate(editor, date, allDay)}
                onClose={() => {
                  // 피커만 닫는다 — scheduleConfirm이 있으면 확인 바로 복귀.
                  setOpenDatePickerEditorId(null);
                  setDatePickerSeed(null);
                }}
              />
            </div>
          ) : scheduleConfirm?.editorId === editor.id ? (
            <div className="schedule-confirm-floating">
              <ScheduleConfirmPopover
                label={scheduleConfirm.label}
                onChangeDate={() => openPickerFromConfirm(editor)}
                onClose={() => setScheduleConfirm(null)}
                onConfirm={() => commitScheduleConfirm(editor)}
              />
            </div>
          ) : null}
        </div>
        {renderHighlight(pane, editor, value)}
        {isAmbientTarget && (
          <div className="split-editor-assist-row">
            {pane.id === focusedPane?.id && editor.id === ambientEmptyEditorId && (
              <span className="ambient-empty-notice">
                유사한 문장이 아직은 없습니다
              </span>
            )}
            {pane.id === focusedPane?.id && editor.id === ambientEditorId && ambientResult && (
              <button
                className="ambient-card ambient-card-compact"
                onClick={() => {
                  const target = ambientResult.memoId
                    ? memos.find(candidate => candidate.id === ambientResult.memoId)
                    : null;
                  if (target) {
                    openMemoInPane(pane.id, target);
                  } else if (ambientResult.sourceKind === 'inbox') {
                    openSourceInPane(pane, ambientResult);
                  }
                }}
                type="button"
              >
                <span>연결 추천</span>
                <strong>{ambientResult.chunkText}</strong>
              </button>
            )}
            {pane.id === focusedPane?.id && editor.id === ambientEditorId && ambientError && (
              <span className="ambient-inline-error">{ambientError}</span>
            )}
          </div>
        )}
        <SimpleEditor
          hideToolbar
          insertTextRequest={insertTextRequests[editor.id] ?? null}
          onAmbientIdle={queryText => {
            patchActiveEditor(pane, { ambientQueryText: queryText });
            onAmbientQuery?.(editor.id, editor.memoId ?? null, queryText);
          }}
          onEditorFocus={() => {
            onFocusPane?.(pane.id);
            if (editor.memoId) {
              onSelectMemoById(editor.memoId);
            }
          }}
          onEditorReady={instance => {
            setEditorInstances(previous => ({
              ...previous,
              [pane.id]: instance,
            }));
          }}
          onInsertTextRequestHandled={requestId =>
            clearInsertTextRequest(editor.id, requestId)
          }
          onRegisterSchedule={() => registerEditorSchedule(editor)}
          value={noteBody}
          onChange={(nextBody: string) =>
            handleChangeMemoText(
              pane,
              editor,
              joinNoteContent(noteTitle, nextBody),
            )
          }
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
            tooltip={isSessionCollapsed ? '사이드바 열기' : '사이드바 접기'}
          >
            {isSessionCollapsed ? (
              <PanelLeft size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </TooltipIconButton>
        )}
        <EditorContext.Provider value={{ editor: focusedToolbarEditor }}>
          <UndoRedoButton action="undo" aria-label="실행 취소" tooltip="실행 취소" />
          <UndoRedoButton action="redo" aria-label="다시 실행" tooltip="다시 실행" />
        </EditorContext.Provider>
        <div className="split-workspace-drag-spacer" />
        {/* 네트워크 검색·메모 고정은 노트 내부(툴바/⋯ 메뉴)로 이동했다.
            다크 모드 토글 복원 시 ThemeToggle을 이 자리에 되돌리면 된다. */}
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
                </div>
              </div>
              <TooltipIconButton
                className="split-editor-tab-add"
                onClick={() => handleAddEditor(pane)}
                tooltip="새 탭"
              >
                <Plus size={15} strokeWidth={2.4} />
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
                      ? 'split 패널 추가'
                      : 'split 패널은 최대 2개까지 열 수 있습니다'
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
                <div className="split-pane-menu-dropdown" ref={setMenuDropdownEl}>
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
                <RenderErrorBoundary
                  fallback={() => (
                    <div className="split-pane-render-error" role="alert">
                      <strong>이 탭을 표시하지 못했습니다.</strong>
                      <button
                        onClick={() => handleCloseAllEditors(pane)}
                        type="button"
                      >
                        노트 탭으로 초기화
                      </button>
                    </div>
                  )}
                  resetKey={`${pane.id}:${activeEditor.id}:${activeEditor.view}`}
                >
                  <PaneBodyRenderer render={() => renderPaneBody(pane, activeEditor)} />
                </RenderErrorBoundary>
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
