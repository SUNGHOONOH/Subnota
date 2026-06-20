import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  CalendarPlus,
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
import { MemoChunk } from '../../lib/memoChunker';
import { NetworkSearchResult } from '../../services/backend/networkService';
import { MemoRow, TopicCluster, TopicMemoEdge, TopicMembership } from '../../types';
import KnowledgeGraphView, {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './components/KnowledgeGraphView';

interface MemoWorkspaceProps {
  activeMemoId: string | null;
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
  onDeleteMemo: () => void;
  onNewMemo: () => void;
  onOpenNetwork: () => void;
  onOpenSearch: () => void;
  onToggleSession: () => void;
  onRegisterSelectionSchedule: () => void;
  onRegisterSelectionScheduleAt: (date: Date, allDay: boolean) => void;
  onSelectMemo: (memo: MemoRow) => void;
  onSelectMemoById: (memoId: string) => void;
  onSelectRange: (start: number, end: number, text?: string) => void;
  saveState: 'idle' | 'saving' | 'saved' | 'failed';
  selectedText: string;
  title: string;
  topicClusters: TopicCluster[];
  topicEdges: TopicMemoEdge[];
  topicMemberships: TopicMembership[];
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

type SidebarMode = 'time' | 'network';
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
  onDeleteMemo,
  onNewMemo,
  onOpenNetwork,
  onOpenSearch,
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
}: MemoWorkspaceProps) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [networkDetail, setNetworkDetail] = useState<NetworkDetail | null>(null);
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('time');
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
        label: '무의식',
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
            tooltip="무의식 지도"
          >
            <Network size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={onOpenSearch}
            placement="bottom"
            tooltip="검색"
          >
            <Search size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={onToggleSession}
            placement="bottom"
            tooltip="사이드바 접기"
          >
            <PanelLeftClose size={18} />
          </TooltipIconButton>
        </div>

        {sidebarMode === 'time' ? (
          <>
            <div className="session-header">
              <div>
                <h2>세션</h2>
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

            <button
              className="new-memo-row"
              onClick={onNewMemo}
              type="button"
            >
              <Plus size={16} />
              새 메모
            </button>

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
                      {openMemoPaneNumbers?.[memo.id] && (
                        <span
                          className="memo-pane-badge"
                          title={`패널 ${openMemoPaneNumbers[memo.id]}에서 열림`}
                        >
                          {openMemoPaneNumbers[memo.id]}
                        </span>
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
        ) : (
          <div className="topic-map-panel">
            <div className="session-header compact">
              <div>
                <h2>무의식 지도</h2>
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
                  ariaLabel="무의식 토픽 지식 그래프"
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

      <main className="memo-editor-shell">
        <div className="editor-toolbar">
          <div>
            <p className="eyebrow">
              {saveState === 'saving'
                ? '저장 중'
                : saveState === 'failed'
                  ? '저장 실패'
                  : '저장됨'}
            </p>
            <h2>{title}</h2>
          </div>
          <div className="toolbar-buttons">
            <button
              className="ghost-button"
              disabled={!selectedText.trim()}
              onClick={onRegisterSelectionSchedule}
              title="선택한 문장을 캘린더 블럭으로 등록"
              type="button"
            >
              <CalendarPlus size={16} />
              일정 등록
            </button>
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
            value={memoDraft}
            onChange={onChangeDraft}
            onSelectionChange={(selectedText: string, from: number, to: number) => {
              onSelectRange(from, to, selectedText);
            }}
            autoFocus
          />
        </div>
        <div className="editor-assist-row">
          {['오늘', '내일', '모레'].map(token => (
            <button
              className="quick-date-chip"
              key={token}
              onClick={() => appendDateToken(token)}
              type="button"
            >
              {token}
            </button>
          ))}
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
        </div>
        {isDatePickerOpen && (
          <DateSchedulePopover
            onApplyDate={applyPickedDate}
            onClose={() => setDatePickerOpen(false)}
          />
        )}

        {ambientResult && (
          <button
            className="ambient-card"
            onClick={() => openNetworkDetail(ambientQueryChunk, ambientResult)}
            type="button"
          >
            <span>{formatNetworkSourceLabel(ambientResult)}</span>
            <strong>{truncate(ambientResult.chunkText, 72)}</strong>
          </button>
        )}

        {(networkQueryChunk || networkError || networkResults.length > 0) && (
          <section className="network-panel">
            <div className="network-panel-header">
              <div>
                <p className="eyebrow">Network</p>
                <h3>커서 문장 기준 연결</h3>
              </div>
            </div>
            {networkQueryChunk && (
              <div className="network-query">
                <span>지금 문장</span>
                <p>{networkQueryChunk.text}</p>
              </div>
            )}
            {networkError && <p className="form-error">{networkError}</p>}
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
            <div className="network-results">
              {networkResults.map(result => (
                <button
                  className="network-result"
                  key={result.chunkId}
                  onClick={() => openNetworkDetail(networkQueryChunk, result)}
                  type="button"
                >
                  <span>
                    {formatNetworkSourceLabel(result)} · 유사도{' '}
                    {Math.round(result.similarity * 100)}%
                  </span>
                  <strong>{result.chunkText}</strong>
                  <p>{truncate(result.memoContent ?? result.title ?? '', 130)}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

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
