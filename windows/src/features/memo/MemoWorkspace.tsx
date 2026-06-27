import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Badge } from '@mantine/core';
import {
  CalendarPlus,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  Network,
  NotebookText,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Trash2,
  X,
} from '@/components/icons';
import { SimpleEditor } from '../../components/tiptap-templates/simple/simple-editor';
import TooltipIconButton from '../../components/TooltipIconButton';
import DateSchedulePopover from './components/DateSchedulePopover';

import {
  DEFAULT_TOPIC_TIME_FILTER,
  TOPIC_NODE_ACTIVE_BOOST,
  TOPIC_NODE_MAX_OPACITY,
  TOPIC_NODE_MAX_RADIUS,
  TOPIC_NODE_MIN_OPACITY,
  TOPIC_NODE_MIN_RADIUS,
  TOPIC_TIME_FILTERS,
  TopicTimeFilterKey,
} from '../../lib/constants';
import { DateMatch, formatRelativeDisplayDate } from '../../lib/dateParser';
import { formatMemoDate } from '../../lib/date';
import { buildMemoSearchIndex, syncMemoSearchIndex } from '../../lib/memoSearch';
import { MemoChunk } from '../../lib/memoChunker';
import { NetworkSearchResult } from '../../services/backend/networkService';
import {
  MemoRow,
  MemoSaveState,
  TopicCluster,
  TopicMemoEdge,
  TopicMembership,
} from '../../types';
import KnowledgeGraphView, {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './components/KnowledgeGraphView';

interface MemoWorkspaceProps {
  activeMemoId: string | null;
  ambientError?: string | null;
  ambientQueryChunk: MemoChunk | null;
  ambientResult: NetworkSearchResult | null;
  dateMatches: DateMatch[];
  memoDraft: string;
  memos: MemoRow[];
  networkError: string | null;
  networkQueryChunk: MemoChunk | null;
  networkResults: NetworkSearchResult[];
  isSessionCollapsed?: boolean;
  openMemoPaneNumbers?: Record<string, number>;
  onChangeDraft: (value: string) => void;
  onAmbientQuery?: (queryText: string) => void;
  onDeleteMemo: () => void;
  onNewMemo: () => void;
  onOpenNetwork: () => void;
  onRetryAmbient?: () => void;
  openSearchSignal?: number;
  onToggleSession: () => void;
  onRegisterSelectionSchedule: () => void;
  onRegisterSelectionScheduleAt: (date: Date, allDay: boolean) => void;
  onSelectMemo: (memo: MemoRow) => void;
  onSelectMemoById: (memoId: string) => void;
  onSelectRange: (start: number, end: number, text?: string) => void;
  saveState: MemoSaveState;
  selectedText: string;
  title: string;
  topicClusters: TopicCluster[];
  topicEdges: TopicMemoEdge[];
  topicMemberships: TopicMembership[];
  workspaceContent?: ReactNode;
}

interface TopicNode {
  cluster: TopicCluster;
  count: number;
  isActiveLinked: boolean;
  opacity: number;
  radius: number;
  x: number;
  y: number;
}

interface NetworkDetail {
  queryChunk: MemoChunk | null;
  result: NetworkSearchResult;
}

type SidebarMode = 'time' | 'network' | 'search' | 'folders';
type TopicDetailMode = 'quick' | 'relation';

const SESSION_RAIL_WIDTH = 284;

const GRAPH_WIDTH = 320;
const GRAPH_HEIGHT = 260;
const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const getMemoTitle = (memo: MemoRow) => {
  const title = memo.content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!title) {
    return '새 메모';
  }

  return title.length > 22 ? `${title.slice(0, 22).trimEnd()}...` : title;
};

const getMemoPreview = (memo: MemoRow) => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const preview = lines[1] ?? lines[0] ?? '내용 없음';

  return preview.length > 38 ? `${preview.slice(0, 38).trimEnd()}...` : preview;
};

const MemoSyncBadge = ({ memo }: { memo: MemoRow }) => {
  if (!memo.local_sync_status) return null;
  const isSynced = memo.local_sync_status === 'synced';
  const isFailed = memo.local_sync_status === 'failed';
  const label = isSynced
    ? '클라우드 동기화됨'
    : isFailed
      ? '클라우드 동기화 실패'
      : '로컬 저장됨';
  return (
    <span aria-label={label} className="memo-sync-badge" title={label}>
      {isSynced ? '☁︎' : isFailed ? '!' : '✓'}
    </span>
  );
};

const getSections = (memos: MemoRow[]) => {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sections = [
    { data: [] as MemoRow[], title: '최근 메모' },
    { data: [] as MemoRow[], title: '오늘' },
    { data: [] as MemoRow[], title: '이전 7일' },
    { data: [] as MemoRow[], title: '이전 30일' },
    { data: [] as MemoRow[], title: '오래된 메모' },
  ];

  memos.forEach(memo => {
    const updatedAt = new Date(memo.updated_at).getTime();
    const ageDays = Math.floor((now - updatedAt) / 86400000);

    if (sections[0].data.length < 3) {
      sections[0].data.push(memo);
      return;
    }

    if (updatedAt >= today.getTime()) {
      sections[1].data.push(memo);
    } else if (ageDays <= 7) {
      sections[2].data.push(memo);
    } else if (ageDays <= 30) {
      sections[3].data.push(memo);
    } else {
      sections[4].data.push(memo);
    }
  });

  return sections.filter(section => section.data.length > 0);
};

const getTopicCutoff = (filterKey: TopicTimeFilterKey) => {
  const filter = TOPIC_TIME_FILTERS.find(item => item.key === filterKey);

  if (!filter?.days) {
    return null;
  }

  return Date.now() - filter.days * 86400000;
};

const buildTopicNodes = ({
  activeMemoId,
  clusters,
  filterKey,
  memberships,
  memos,
}: {
  activeMemoId: string | null;
  clusters: TopicCluster[];
  filterKey: TopicTimeFilterKey;
  memberships: TopicMembership[];
  memos: MemoRow[];
}) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));
  const cutoff = getTopicCutoff(filterKey);
  const nodes: TopicNode[] = [];

  clusters.forEach(cluster => {
    const topicMemberships = memberships.filter(
      membership => membership.topicId === cluster.id,
    );
    const topicMemos = topicMemberships
      .map(membership => memoById.get(membership.memoId))
      .filter((memo): memo is MemoRow => Boolean(memo));
    const filteredMemos = cutoff
      ? topicMemos.filter(memo => {
          const timestamp = Math.max(
            new Date(memo.updated_at).getTime(),
            new Date(memo.created_at).getTime(),
          );

          return timestamp >= cutoff;
        })
      : topicMemos;
    const isActiveLinked = Boolean(
      activeMemoId &&
        topicMemberships.some(membership => membership.memoId === activeMemoId),
    );

    if (filteredMemos.length === 0 && !isActiveLinked) {
      return;
    }

    const newestTimestamp = topicMemos.reduce((latest, memo) => {
      return Math.max(
        latest,
        new Date(memo.updated_at).getTime(),
        new Date(memo.created_at).getTime(),
      );
    }, 0);
    const ageDays = newestTimestamp
      ? Math.floor((Date.now() - newestTimestamp) / 86400000)
      : 365;
    const recencyOpacity =
      filterKey === 'all'
        ? clamp(1 - ageDays / 730, TOPIC_NODE_MIN_OPACITY, 0.86)
        : clamp(1 - ageDays / 365, TOPIC_NODE_MIN_OPACITY, 0.92);
    const opacity = clamp(
      recencyOpacity + (isActiveLinked ? TOPIC_NODE_ACTIVE_BOOST : 0),
      TOPIC_NODE_MIN_OPACITY,
      TOPIC_NODE_MAX_OPACITY,
    );
    const count = Math.max(filteredMemos.length, isActiveLinked ? 1 : 0);
    const radius = clamp(
      TOPIC_NODE_MIN_RADIUS + count * 2 + (cluster.confidence ?? 0) * 2,
      TOPIC_NODE_MIN_RADIUS,
      TOPIC_NODE_MAX_RADIUS,
    );
    const angle = (Math.PI * 2 * nodes.length) / Math.max(clusters.length, 1) - Math.PI / 2;
    const orbit = Math.min(GRAPH_CENTER_X, GRAPH_CENTER_Y) * 0.62;

    nodes.push({
      cluster,
      count,
      isActiveLinked,
      opacity,
      radius,
      x: GRAPH_CENTER_X + Math.cos(angle) * orbit,
      y: GRAPH_CENTER_Y + Math.sin(angle) * orbit,
    });
  });

  return nodes;
};

const truncate = (text: string, length: number) => {
  return text.length > length ? `${text.slice(0, length).trimEnd()}...` : text;
};

const getTopicMemoRows = ({
  memberships,
  memos,
  topicId,
}: {
  memberships: TopicMembership[];
  memos: MemoRow[];
  topicId: string;
}) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));

  return memberships
    .filter(membership => membership.topicId === topicId)
    .map(membership => {
      const memo = memoById.get(membership.memoId);

      return memo ? { memo, score: membership.score ?? 0.5 } : null;
    })
    .filter((item): item is { memo: MemoRow; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score);
};

const buildFallbackTopicEdges = (
  rows: Array<{ memo: MemoRow; score: number }>,
) => {
  const edges: TopicMemoEdge[] = [];

  rows.slice(1).forEach((row, index) => {
    const source = rows[0];
    const previous = rows[index];

    edges.push({
      similarity: Math.max(0.35, Math.min(0.92, (source.score + row.score) / 2)),
      sourceMemoId: source.memo.id,
      targetMemoId: row.memo.id,
      topicId: '',
    });

    if (previous && previous.memo.id !== source.memo.id) {
      edges.push({
        similarity: Math.max(0.28, Math.min(0.82, (previous.score + row.score) / 2)),
        sourceMemoId: previous.memo.id,
        targetMemoId: row.memo.id,
        topicId: '',
      });
    }
  });

  return edges;
};

const HighlightedMemo = ({ result }: { result: NetworkSearchResult }) => {
  if (result.sourceKind === 'inbox' || !result.memoContent) {
    return (
      <p className="network-memo-body">
        {result.title && <strong>{result.title}</strong>}
        {result.title && <br />}
        {result.chunkText}
      </p>
    );
  }

  const start = Math.max(0, Math.min(result.startIndex, result.memoContent.length));
  const end = Math.max(start, Math.min(result.endIndex, result.memoContent.length));
  const before = result.memoContent.slice(0, start);
  const highlighted = result.memoContent.slice(start, end) || result.chunkText;
  const after = result.memoContent.slice(end);

  return (
    <p className="network-memo-body">
      {before}
      <mark>{highlighted}</mark>
      {after}
    </p>
  );
};

// Coral shades for connected-memo dots, darker = more similar (design palette).
const networkSimilarityColor = (similarity: number) => {
  if (similarity >= 0.9) return '#cc785c';
  if (similarity >= 0.8) return '#d4866b';
  if (similarity >= 0.7) return '#dfa085';
  return '#e4a98e';
};

const formatNetworkResultDate = (result: NetworkSearchResult) => {
  const ms = result.memoUpdatedAt ?? result.memoCreatedAt ?? result.createdAt;
  return ms ? format(new Date(ms), 'M월 d일') : '';
};

const formatNetworkSourceLabel = (result: NetworkSearchResult) => {
  if (result.sourceKind === 'inbox') {
    return result.sourceLabel ?? '수집함';
  }

  const timestamp = result.memoCreatedAt;
  if (!timestamp) {
    return '이전 메모';
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)),
  );

  if (days === 0) {
    return '오늘 메모';
  }
  return `${days}일 전 메모`;
};

const MemoWorkspace = ({
  activeMemoId,
  ambientError = null,
  isSessionCollapsed = false,
  openMemoPaneNumbers,
  ambientQueryChunk,
  ambientResult,
  dateMatches,
  memoDraft,
  memos,
  networkError,
  networkQueryChunk,
  networkResults,
  onChangeDraft,
  onAmbientQuery,
  onDeleteMemo,
  onNewMemo,
  onOpenNetwork,
  onRetryAmbient,
  openSearchSignal,
  onToggleSession,
  onRegisterSelectionSchedule,
  onRegisterSelectionScheduleAt,
  onSelectMemo,
  onSelectMemoById,
  onSelectRange,
  saveState,
  selectedText,
  title,
  topicClusters,
  topicEdges,
  topicMemberships,
  workspaceContent,
}: MemoWorkspaceProps) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [networkDetail, setNetworkDetail] = useState<NetworkDetail | null>(null);
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('time');
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchIndexRef = useRef(buildMemoSearchIndex([]));
  const indexedMemoVersionsRef = useRef(new Map<string, string>());
  const [searchIndexVersion, setSearchIndexVersion] = useState(0);
  useEffect(() => {
    syncMemoSearchIndex(searchIndexRef.current, indexedMemoVersionsRef.current, memos);
    setSearchIndexVersion(version => version + 1);
  }, [memos]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      return memos.slice(0, 12);
    }
    const byId = new Map(memos.map(memo => [memo.id, memo]));
    return searchIndexRef.current
      .search(query, {
        boost: { category: 1.4 },
        fuzzy: query.length > 2 ? 0.2 : false,
        prefix: true,
      })
      .slice(0, 20)
      .map(result => byId.get(String(result.id)))
      .filter((memo): memo is MemoRow => Boolean(memo));
  }, [memos, searchIndexVersion, searchQuery]);

  // App이 검색 단축키로 openSearchSignal을 올리면 검색 모드로 전환한다.
  useEffect(() => {
    if (!openSearchSignal) {
      return;
    }
    setSidebarMode('search');
  }, [openSearchSignal]);

  useEffect(() => {
    if (sidebarMode !== 'search') {
      return undefined;
    }
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [sidebarMode, openSearchSignal]);

  const [insertTextRequest, setInsertTextRequest] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [topicDetailMode, setTopicDetailMode] = useState<TopicDetailMode>('quick');
  const [topicFilterKey, setTopicFilterKey] = useState<TopicTimeFilterKey>(
    DEFAULT_TOPIC_TIME_FILTER,
  );
  const firstDateMatch = dateMatches[0] ?? null;
  const activeTopicMemoIds = useMemo(() => {
    return new Set(
      topicMemberships
        .filter(membership => membership.topicId === activeTopicId)
        .map(membership => membership.memoId),
    );
  }, [activeTopicId, topicMemberships]);
  const sidebarMemos = memos;
  const visibleMemos =
    activeTopicId
      ? sidebarMemos.filter(memo => activeTopicMemoIds.has(memo.id))
      : sidebarMemos;
  const sections = getSections(visibleMemos);
  // Topic clusters (State A) rendered as collapsible folders in the session
  // rail. Reuses getTopicMemoRows so a folder lists the same member memos the
  // topic detail view would, sorted by membership score then folder size.
  const topicFolders = useMemo(
    () =>
      topicClusters
        .map(cluster => ({
          cluster,
          rows: getTopicMemoRows({
            memberships: topicMemberships,
            memos,
            topicId: cluster.id,
          }),
        }))
        .filter(folder => folder.rows.length > 0)
        .sort((a, b) => b.rows.length - a.rows.length),
    [memos, topicClusters, topicMemberships],
  );
  const topicNodes = useMemo(
    () =>
      buildTopicNodes({
        activeMemoId,
        clusters: topicClusters,
        filterKey: topicFilterKey,
        memberships: topicMemberships,
        memos,
      }),
    [activeMemoId, memos, topicClusters, topicFilterKey, topicMemberships],
  );
  const topicGraphNodes = useMemo<KnowledgeGraphNode[]>(
    () => [
      {
        color: '#8b7355',
        id: 'topic-root',
        label: 'Topics',
        size: 10,
        x: GRAPH_CENTER_X,
        y: GRAPH_CENTER_Y,
      },
      ...topicNodes.map(node => ({
        color: node.isActiveLinked ? '#236b45' : '#5c4d3c',
        id: `topic:${node.cluster.id}`,
        label: node.cluster.label,
        muted: node.opacity < 0.55,
        size: clamp(node.radius / 2, 6, 14),
        x: node.x,
        y: node.y,
      })),
    ],
    [topicNodes],
  );
  const topicGraphEdges = useMemo<KnowledgeGraphEdge[]>(
    () =>
      topicNodes.map(node => ({
        id: `topic-root-${node.cluster.id}`,
        source: 'topic-root',
        target: `topic:${node.cluster.id}`,
        weight: node.opacity,
      })),
    [topicNodes],
  );
  const networkGraphNodes = useMemo<KnowledgeGraphNode[]>(() => {
    if (!networkQueryChunk || networkResults.length === 0) {
      return [];
    }

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
    const total = Math.max(networkResults.length, 1);

    networkResults.forEach((result, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const similarity = clamp(result.similarity, 0, 1);
      const distance = 1.05 - similarity * 0.45;

      nodes.push({
        color: result.sourceKind === 'inbox' ? '#6d7185' : '#7f8a6f',
        id: `network:${result.chunkId}`,
        label: `${Math.round(similarity * 100)}%`,
        size: clamp(5 + similarity * 9, 6, 14),
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    });

    return nodes;
  }, [networkQueryChunk, networkResults]);
  const networkGraphEdges = useMemo<KnowledgeGraphEdge[]>(
    () =>
      networkResults.map(result => ({
        id: `network-edge-${result.chunkId}`,
        source: 'network:query',
        target: `network:${result.chunkId}`,
        weight: result.similarity,
      })),
    [networkResults],
  );
  const activeTopic = topicClusters.find(topic => topic.id === activeTopicId) ?? null;
  const selectedTopic =
    topicClusters.find(topic => topic.id === selectedTopicId) ?? null;
  const selectedTopicRows = selectedTopic
    ? getTopicMemoRows({
        memberships: topicMemberships,
        memos,
        topicId: selectedTopic.id,
      })
    : [];
  const selectedTopicEdges = selectedTopic
    ? topicEdges.filter(edge => edge.topicId === selectedTopic.id)
    : [];
  const relationEdges =
    selectedTopicEdges.length > 0
      ? selectedTopicEdges
      : buildFallbackTopicEdges(selectedTopicRows);
  const isRelationFallback = selectedTopicEdges.length === 0;
  const relationGraphNodes = useMemo<KnowledgeGraphNode[]>(() => {
    if (!selectedTopic) {
      return [];
    }

    const nodes: KnowledgeGraphNode[] = [
      {
        color: '#8b7355',
        id: `topic:${selectedTopic.id}`,
        label: selectedTopic.label,
        size: 13,
        x: 0,
        y: 0,
      },
    ];
    const total = Math.max(selectedTopicRows.length, 1);

    selectedTopicRows.forEach(({ memo, score }, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const normalizedScore = clamp(score, 0, 1);

      nodes.push({
        color: memo.id === activeMemoId ? '#236b45' : '#5c4d3c',
        id: `memo:${memo.id}`,
        label: truncate(getMemoTitle(memo), 14),
        size: clamp(6 + normalizedScore * 8, 7, 14),
        x: Math.cos(angle),
        y: Math.sin(angle),
      });
    });

    return nodes;
  }, [activeMemoId, selectedTopic, selectedTopicRows]);
  const relationGraphEdges = useMemo<KnowledgeGraphEdge[]>(() => {
    if (!selectedTopic) {
      return [];
    }

    const scoreEdges = selectedTopicRows.map(({ memo, score }) => ({
      id: `topic-${selectedTopic.id}-${memo.id}`,
      source: `topic:${selectedTopic.id}`,
      target: `memo:${memo.id}`,
      weight: clamp(score, 0, 1) * 0.5,
    }));
    const memoEdges = relationEdges.map((edge, index) => ({
      id: `relation-${edge.sourceMemoId}-${edge.targetMemoId}-${index}`,
      source: `memo:${edge.sourceMemoId}`,
      target: `memo:${edge.targetMemoId}`,
      weight: edge.similarity,
    }));

    return [...scoreEdges, ...memoEdges];
  }, [relationEdges, selectedTopic, selectedTopicRows]);

  /*
  const handleSelection = (element: HTMLTextAreaElement) => {
    onSelectRange(element.selectionStart, element.selectionEnd);
  };
  */

  const appendDateToken = (token: string) => {
    setInsertTextRequest({
      id: `date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: `${token} `,
    });
  };

  const applyPickedDate = (date: Date, allDay: boolean) => {
    if (selectedText.trim()) {
      onRegisterSelectionScheduleAt(date, allDay);
    } else {
      appendDateToken(format(date, allDay ? 'yy.MM.dd' : 'yy.MM.dd HH:mm'));
    }
    setDatePickerOpen(false);
  };

  const openNetworkDetail = (
    queryChunk: MemoChunk | null,
    result: NetworkSearchResult,
  ) => {
    setNetworkDetail({ queryChunk, result });
  };

  const openTopicDetail = (topicId: string) => {
    setSelectedTopicId(topicId);
    setTopicDetailMode('quick');
  };

  const toggleTopicFolder = (topicId: string) =>
    setExpandedTopicIds(previous => {
      const next = new Set(previous);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });

  return (
    <div className="memo-layout">
      {isSessionCollapsed && (
        <button
          aria-label="사이드바 열기"
          className="session-expand-btn"
          onClick={onToggleSession}
          title="사이드바 열기"
          type="button"
        >
          <PanelLeft size={18} />
        </button>
      )}
      <motion.aside
        className="session-rail"
        initial={false}
        animate={{ width: isSessionCollapsed ? 0 : SESSION_RAIL_WIDTH }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
       <div className="session-rail-inner">
        <div className="segment-control">
          <TooltipIconButton
            className={sidebarMode === 'time' ? 'active' : ''}
            onClick={() => setSidebarMode('time')}
            placement="bottom"
            tooltip="메모"
          >
            <NotebookText size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            className={sidebarMode === 'network' ? 'active' : ''}
            onClick={() => {
              setActiveTopicId(null);
              setSidebarMode('network');
            }}
            placement="bottom"
            tooltip="Topics"
          >
            <Network size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            className={sidebarMode === 'search' ? 'active' : ''}
            onClick={() => setSidebarMode('search')}
            placement="bottom"
            tooltip="검색"
          >
            <Search size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            className={sidebarMode === 'folders' ? 'active' : ''}
            onClick={() => {
              setActiveTopicId(null);
              setSidebarMode('folders');
            }}
            placement="bottom"
            tooltip="토픽 폴더"
          >
            <Folder size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={onToggleSession}
            placement="bottom"
            tooltip="사이드바 접기"
          >
            <PanelLeftClose size={18} />
          </TooltipIconButton>
        </div>

        {sidebarMode === 'search' ? (
          <div className="rail-search">
            <div className="rail-search-row">
              <Search size={16} />
              <input
                ref={searchInputRef}
                aria-label="메모 검색어"
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="입력하여 검색하세요"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  aria-label="검색어 지우기"
                  className="rail-search-clear"
                  onClick={() => setSearchQuery('')}
                  type="button"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="rail-search-results">
              {searchResults.length === 0 ? (
                <p className="search-empty">일치하는 결과가 없습니다.</p>
              ) : (
                searchResults.map(memo => (
                  <button
                    className={memo.id === activeMemoId ? 'memo-row active' : 'memo-row'}
                    key={memo.id}
                    onClick={() => onSelectMemo(memo)}
                    type="button"
                  >
                    <strong>{getMemoTitle(memo)}</strong>
                    <span>
                      {formatMemoDate(memo.updated_at)} · {getMemoPreview(memo)}
                    </span>
                    <MemoSyncBadge memo={memo} />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : sidebarMode === 'time' ? (
          <>
            <div className="session-header">
              <div>
                <h2>노트</h2>
                <p>{activeTopic ? `필터: ${activeTopic.label}` : '최근 메모'}</p>
              </div>
              <span>{visibleMemos.length}</span>
            </div>

            {activeTopic && (
              <button
                className="filter-clear-row"
                onClick={() => setActiveTopicId(null)}
                type="button"
              >
                필터 해제
                <X size={14} />
              </button>
            )}

            <div className="session-list">
              {sections.map(section => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  {section.data.map(memo => (
                    <button
                      className={memo.id === activeMemoId ? 'memo-row active' : 'memo-row'}
                      key={memo.id}
                      onClick={() => onSelectMemo(memo)}
                      type="button"
                    >
                      <strong>{getMemoTitle(memo)}</strong>
                      <span>
                        {formatMemoDate(memo.updated_at)} · {getMemoPreview(memo)}
                      </span>
                      <MemoSyncBadge memo={memo} />
                      {openMemoPaneNumbers?.[memo.id] && (
                        <Badge
                          circle
                          className="memo-pane-badge"
                          color="teal"
                          component="span"
                          size="sm"
                          title={`패널 ${openMemoPaneNumbers[memo.id]}에서 열림`}
                          variant="filled"
                        >
                          {openMemoPaneNumbers[memo.id]}
                        </Badge>
                      )}
                    </button>
                  ))}
                </section>
              ))}
              {visibleMemos.length === 0 && (
                <p className="empty-text">
                  이 필터에 해당하는 메모가 없습니다.
                </p>
              )}
            </div>
          </>
        ) : sidebarMode === 'folders' ? (
          <>
            <div className="session-header">
              <div>
                <h2>토픽 폴더</h2>
                <p>
                  {topicClusters.length > 0
                    ? 'State A 토픽 클러스터'
                    : '아직 토픽이 없습니다'}
                </p>
              </div>
              <span>{topicFolders.length}</span>
            </div>
            <div className="topic-folder-list">
              {topicFolders.length === 0 ? (
                <p className="empty-text">
                  저녁 batch가 topic_clusters를 만들면 여기에 폴더가 표시됩니다.
                </p>
              ) : (
                topicFolders.map(({ cluster, rows }) => {
                  const isExpanded = expandedTopicIds.has(cluster.id);

                  return (
                    <section className="topic-folder" key={cluster.id}>
                      <button
                        aria-expanded={isExpanded}
                        className="topic-folder-head"
                        onClick={() => toggleTopicFolder(cluster.id)}
                        type="button"
                      >
                        <span className="topic-folder-chevron">
                          <ChevronRight size={14} />
                        </span>
                        {isExpanded ? (
                          <FolderOpen size={16} />
                        ) : (
                          <Folder size={16} />
                        )}
                        <span className="topic-folder-label">
                          {cluster.label}
                        </span>
                        <em className="topic-folder-count">{rows.length}</em>
                      </button>
                      {isExpanded && (
                        <div className="topic-folder-memos">
                          {rows.map(({ memo }) => (
                            <button
                              className={
                                memo.id === activeMemoId
                                  ? 'memo-row active'
                                  : 'memo-row'
                              }
                              key={memo.id}
                              onClick={() => onSelectMemo(memo)}
                              type="button"
                            >
                              <strong>{getMemoTitle(memo)}</strong>
                              <span>
                                {formatMemoDate(memo.updated_at)} ·{' '}
                                {getMemoPreview(memo)}
                              </span>
                              <MemoSyncBadge memo={memo} />
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="topic-map-panel">
            <div className="session-header compact">
              <div>
                <h2>Topics</h2>
                <p>State A topic discovery</p>
              </div>
              <span>{topicClusters.length}</span>
            </div>
            <div className="topic-filter-row">
              {TOPIC_TIME_FILTERS.map(filter => (
                <button
                  className={topicFilterKey === filter.key ? 'active' : ''}
                  key={filter.key}
                  onClick={() => setTopicFilterKey(filter.key)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {topicNodes.length > 0 ? (
              <>
                <KnowledgeGraphView
                  activeNodeId={activeTopicId ? `topic:${activeTopicId}` : null}
                  ariaLabel="Topics 지식 그래프"
                  className="topic-graph-shell"
                  edges={topicGraphEdges}
                  nodes={topicGraphNodes}
                  onSelectNode={nodeId => {
                    if (nodeId.startsWith('topic:')) {
                      openTopicDetail(nodeId.slice('topic:'.length));
                    }
                  }}
                />
                <div className="topic-list">
                  {topicNodes.map(node => (
                    <button
                      key={node.cluster.id}
                      onClick={() => openTopicDetail(node.cluster.id)}
                      type="button"
                    >
                      <span>{node.cluster.label}</span>
                      <em>{node.count}</em>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="topic-empty">
                저녁 batch가 topic_clusters를 만들면 여기에 State A 지도가 표시됩니다.
              </p>
            )}
          </div>
        )}
       </div>
      </motion.aside>

      {workspaceContent ?? (
      <main className="memo-editor-shell">
        <div className="editor-toolbar">
          <div>
            <p className="eyebrow">
              <span className="save-state-icon" aria-hidden="true">
                {saveState === 'synced' || saveState === 'syncing' || saveState === 'failed'
                  ? '☁︎'
                  : saveState === 'local-failed'
                    ? '!'
                    : '✓'}
              </span>
              {saveState === 'saving-local'
                ? '로컬 저장 중'
                : saveState === 'syncing'
                  ? '클라우드 동기화 중'
                : saveState === 'failed'
                  ? '로컬 저장됨 · 동기화 실패'
                  : saveState === 'local-failed'
                    ? '로컬 저장 실패'
                  : saveState === 'local'
                    ? '로컬 저장됨'
                    : saveState === 'synced'
                      ? '클라우드 동기화됨'
                      : '저장됨'}
            </p>
            <h2>{title}</h2>
          </div>
          <div className="toolbar-buttons">
            <TooltipIconButton
              className="ghost-button"
              disabled={!selectedText.trim()}
              onClick={onRegisterSelectionSchedule}
              tooltip="일정 등록"
            >
              <CalendarPlus size={16} />
            </TooltipIconButton>
            <button
              className="ghost-button"
              onClick={onOpenNetwork}
              title="커서 문장 기준 네트워크 검색"
              type="button"
            >
              <Network size={16} />
              네트워크
            </button>
            <button className="icon-button" onClick={onDeleteMemo} type="button">
              <Trash2 size={18} />
            </button>
            <button
              className="icon-button"
              onClick={onNewMemo}
              type="button"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div className="memo-paper-wrapper">
          <SimpleEditor
            insertTextRequest={insertTextRequest}
            onInsertTextRequestHandled={id => {
              setInsertTextRequest(current => (current?.id === id ? null : current));
            }}
            onAmbientIdle={onAmbientQuery}
            value={memoDraft}
            onChange={onChangeDraft}
            onSelectionChange={(selectedText: string, from: number, to: number) => {
              onSelectRange(from, to, selectedText);
            }}
            autoFocus
          />
        </div>
        <div className="editor-assist-row">
          <button
            className="quick-date-chip"
            onClick={() => setDatePickerOpen(value => !value)}
            type="button"
          >
            날짜 선택
          </button>
          {firstDateMatch && (
            <span className="date-detect-chip">
              {firstDateMatch.text} → {formatRelativeDisplayDate(firstDateMatch.date)}
            </span>
          )}
          {selectedText.trim() && (
            <span className="selected-text-chip">
              선택됨: {truncate(selectedText, 30)}
            </span>
          )}
          {ambientResult && (
            <button
              className="ambient-card ambient-card-compact"
              onClick={() => openNetworkDetail(ambientQueryChunk, ambientResult)}
              type="button"
            >
              <span>{formatNetworkSourceLabel(ambientResult)}</span>
              <strong>{truncate(ambientResult.chunkText, 72)}</strong>
            </button>
          )}
          {ambientError && (
            <span className="ambient-inline-error">
              {ambientError}
              <button onClick={onRetryAmbient} type="button">다시 시도</button>
            </span>
          )}
        </div>
        {isDatePickerOpen && (
          <DateSchedulePopover
            onApplyDate={applyPickedDate}
            onClose={() => setDatePickerOpen(false)}
          />
        )}
        {(networkQueryChunk || networkError || networkResults.length > 0) && (
          <section className="network-panel network-immersive">
            {networkQueryChunk && networkResults.length > 0 && (
              <KnowledgeGraphView
                activeNodeId="network:query"
                ariaLabel="커서 문장 기준 유사 메모 그래프"
                className="network-graph-shell"
                edges={networkGraphEdges}
                nodes={networkGraphNodes}
                onSelectNode={nodeId => {
                  if (!nodeId.startsWith('network:') || nodeId === 'network:query') {
                    return;
                  }

                  const chunkId = nodeId.slice('network:'.length);
                  const result = networkResults.find(item => item.chunkId === chunkId);

                  if (result) {
                    openNetworkDetail(networkQueryChunk, result);
                  }
                }}
              />
            )}

            {networkError && (
              <div className="network-inline-error">
                <p className="form-error">{networkError}</p>
                <button className="quick-date-chip" onClick={onOpenNetwork} type="button">
                  다시 시도
                </button>
              </div>
            )}

            {networkQueryChunk && (
              <div className="network-sentence-card">
                <span className="network-sentence-eyebrow">지금 문장</span>
                <p>{networkQueryChunk.text}</p>
              </div>
            )}

            {networkResults.length > 0 && (
              <div className="network-connected">
                <div className="network-connected-head">
                  <span className="network-connected-eyebrow">연결된 메모</span>
                  <span className="network-connected-count">
                    유사도 순 · {networkResults.length}
                  </span>
                </div>
                <div className="network-connected-scroll">
                  {networkResults.map(result => {
                    const memo = result.memoId
                      ? memos.find(item => item.id === result.memoId)
                      : undefined;
                    return (
                      <button
                        className="network-connected-card"
                        key={result.chunkId}
                        onClick={() => openNetworkDetail(networkQueryChunk, result)}
                        type="button"
                      >
                        <div className="network-connected-card-top">
                          <span
                            className="network-connected-dot"
                            style={{
                              backgroundColor: networkSimilarityColor(result.similarity),
                            }}
                          />
                          <strong>{result.chunkText}</strong>
                          <span className="network-connected-pct">
                            {Math.round(result.similarity * 100)}%
                          </span>
                        </div>
                        <div className="network-connected-card-bottom">
                          <span className="network-connected-date">
                            {formatNetworkResultDate(result)}
                          </span>
                          {memo && (
                            <span
                              className="network-connected-open"
                              onClick={event => {
                                event.stopPropagation();
                                onSelectMemo(memo);
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              <ExternalLink size={12} />
                              새 탭으로 노트 열기
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      )}

      {selectedTopic && (
        <div className="modal-backdrop detail-backdrop" role="presentation">
          <section className="detail-panel topic-detail-panel">
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Topic Detail</p>
                <h2>{selectedTopic.label}</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setSelectedTopicId(null)}
                type="button"
              >
                닫기
              </button>
            </div>

            <div className="topic-detail-tabs">
              <button
                className={topicDetailMode === 'quick' ? 'active' : ''}
                onClick={() => setTopicDetailMode('quick')}
                type="button"
              >
                빠른 보기
              </button>
              <button
                className={topicDetailMode === 'relation' ? 'active' : ''}
                onClick={() => setTopicDetailMode('relation')}
                type="button"
              >
                관계 보기
              </button>
            </div>

            {topicDetailMode === 'quick' ? (
              <div className="topic-memo-quick-grid">
                {selectedTopicRows.length === 0 && (
                  <p className="empty-text">이 topic에 연결된 로컬 메모가 없습니다.</p>
                )}
                {selectedTopicRows.map(({ memo, score }, index) => (
                  <button
                    className="topic-memo-card"
                    key={memo.id}
                    onClick={() => {
                      onSelectMemo(memo);
                      setSelectedTopicId(null);
                    }}
                    type="button"
                  >
                    <span>{index === 0 ? '대표 후보' : `연결 점수 ${Math.round(score * 100)}%`}</span>
                    <strong>{getMemoTitle(memo)}</strong>
                    <p>{getMemoPreview(memo)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {isRelationFallback && (
                  <p className="topic-relation-note">
                    정밀 edge batch 전이라 membership 점수 기반으로 임시 연결을 보여줍니다.
                  </p>
                )}
                <KnowledgeGraphView
                  activeNodeId={activeMemoId ? `memo:${activeMemoId}` : null}
                  ariaLabel={`${selectedTopic.label} 토픽 관계 그래프`}
                  className="topic-relation-view"
                  edges={relationGraphEdges}
                  nodes={relationGraphNodes}
                  onSelectNode={nodeId => {
                    if (!nodeId.startsWith('memo:')) {
                      return;
                    }

                    const memoId = nodeId.slice('memo:'.length);
                    const row = selectedTopicRows.find(item => item.memo.id === memoId);

                    if (row) {
                      onSelectMemo(row.memo);
                      setSelectedTopicId(null);
                    }
                  }}
                />
              </div>
            )}

            <div className="sheet-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setActiveTopicId(selectedTopic.id);
                  setSelectedTopicId(null);
                  setSidebarMode('time');
                }}
                type="button"
              >
                목록으로 보기
              </button>
            </div>
          </section>
        </div>
      )}

      {networkDetail && (
        <div className="modal-backdrop detail-backdrop" role="presentation">
          <section className="detail-panel network-detail-panel">
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Associative Memory</p>
                <h2>비슷한 문장</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setNetworkDetail(null)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="network-compare">
              <article>
                <span>지금 쓰는 문장</span>
                <p>{networkDetail.queryChunk?.text ?? '현재 문장 없음'}</p>
              </article>
              <article>
                <span>
                  {formatNetworkSourceLabel(networkDetail.result)} · 유사도{' '}
                  {Math.round(networkDetail.result.similarity * 100)}%
                </span>
                <p>{networkDetail.result.chunkText}</p>
              </article>
            </div>
            <HighlightedMemo result={networkDetail.result} />
            <div className="sheet-actions">
              {networkDetail.result.sourceKind === 'inbox' ? (
                networkDetail.result.sourceUrl && (
                  <a
                    className="secondary-button"
                    href={networkDetail.result.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    원문 열기
                  </a>
                )
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (networkDetail.result.memoId) {
                      onSelectMemoById(networkDetail.result.memoId);
                    }
                    setNetworkDetail(null);
                  }}
                  type="button"
                >
                  이 메모로 이동
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default MemoWorkspace;
