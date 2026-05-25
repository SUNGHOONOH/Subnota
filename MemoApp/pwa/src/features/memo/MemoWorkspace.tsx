import { useMemo, useState } from 'react';
import { CalendarPlus, Network, Plus, Trash2, X } from 'lucide-react';

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
  onChangeDraft: (value: string) => void;
  onDeleteMemo: () => void;
  onNewMemo: () => void;
  onOpenNetwork: () => void;
  onRegisterSelectionSchedule: () => void;
  onSelectMemo: (memo: MemoRow) => void;
  onSelectMemoById: (memoId: string) => void;
  onSelectRange: (start: number, end: number) => void;
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

const MemoWorkspace = ({
  activeMemoId,
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
  onRegisterSelectionSchedule,
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
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('time');
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
  const visibleMemos = activeTopicId
    ? memos.filter(memo => activeTopicMemoIds.has(memo.id))
    : memos;
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

  const handleSelection = (element: HTMLTextAreaElement) => {
    onSelectRange(element.selectionStart, element.selectionEnd);
  };

  const appendDateToken = (token: string) => {
    onChangeDraft(`${memoDraft}${memoDraft.endsWith(' ') || !memoDraft ? '' : ' '}${token} `);
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
      <aside className="session-rail">
        <div className="segment-control">
          <button
            className={sidebarMode === 'time' ? 'active' : ''}
            onClick={() => setSidebarMode('time')}
            type="button"
          >
            시간순
          </button>
          <button
            className={sidebarMode === 'network' ? 'active' : ''}
            onClick={() => setSidebarMode('network')}
            type="button"
          >
            무의식 지도
          </button>
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

            <button className="new-memo-row" onClick={onNewMemo} type="button">
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
                    </button>
                  ))}
                </section>
              ))}
              {visibleMemos.length === 0 && (
                <p className="empty-text">이 필터에 해당하는 메모가 없습니다.</p>
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
                <div className="topic-graph-shell">
                  <svg role="img" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
                    <line
                      stroke="#d8cebc"
                      strokeDasharray="5 7"
                      strokeWidth="1"
                      x1={GRAPH_CENTER_X}
                      x2={GRAPH_CENTER_X}
                      y1="24"
                      y2={GRAPH_HEIGHT - 24}
                    />
                    <circle
                      cx={GRAPH_CENTER_X}
                      cy={GRAPH_CENTER_Y}
                      fill="#faf6f0"
                      r="25"
                      stroke="#d8cebc"
                      strokeWidth="1.2"
                    />
                    <text
                      fill="#2c2520"
                      fontSize="11"
                      fontWeight="800"
                      textAnchor="middle"
                      x={GRAPH_CENTER_X}
                      y={GRAPH_CENTER_Y + 4}
                    >
                      무의식
                    </text>
                    {topicNodes.map(node => (
                      <g
                        className="topic-node"
                        key={node.cluster.id}
                        onClick={() => openTopicDetail(node.cluster.id)}
                      >
                        <line
                          stroke={node.isActiveLinked ? '#236b45' : '#d8cebc'}
                          strokeOpacity={node.opacity}
                          strokeWidth={node.isActiveLinked ? 1.6 : 1}
                          x1={GRAPH_CENTER_X}
                          x2={node.x}
                          y1={GRAPH_CENTER_Y}
                          y2={node.y}
                        />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          fill="#faf6f0"
                          fillOpacity={node.opacity}
                          r={node.radius}
                          stroke={node.isActiveLinked ? '#236b45' : '#5c4d3c'}
                          strokeOpacity={node.opacity}
                          strokeWidth={node.isActiveLinked ? 2 : 1.2}
                        />
                        <text
                          fill="#2c2520"
                          fillOpacity={node.opacity}
                          fontSize="10"
                          fontWeight="750"
                          textAnchor="middle"
                          x={node.x}
                          y={node.y - 1}
                        >
                          {truncate(node.cluster.label, 8)}
                        </text>
                        <text
                          fill="#8b7355"
                          fillOpacity={node.opacity}
                          fontSize="8"
                          fontWeight="700"
                          textAnchor="middle"
                          x={node.x}
                          y={node.y + 11}
                        >
                          {node.count}개
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
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
      </aside>

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
            <button className="icon-button" onClick={onNewMemo} type="button">
              <Plus size={18} />
            </button>
          </div>
        </div>
        <textarea
          autoFocus
          className="memo-paper"
          onChange={event => onChangeDraft(event.target.value)}
          onClick={event => handleSelection(event.currentTarget)}
          onKeyUp={event => handleSelection(event.currentTarget)}
          onSelect={event => handleSelection(event.currentTarget)}
          placeholder="메모를 시작하세요"
          spellCheck={false}
          value={memoDraft}
        />
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

        {ambientResult && (
          <button
            className="ambient-card"
            onClick={() => openNetworkDetail(ambientQueryChunk, ambientResult)}
            type="button"
          >
            <span>떠오른 과거 문장</span>
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
              <div className="network-graph-shell">
                <svg role="img" viewBox="0 0 420 220">
                  <circle
                    cx="210"
                    cy="110"
                    fill="#5c4d3c"
                    r="28"
                    stroke="#5c4d3c"
                    strokeWidth="1.4"
                  />
                  <text
                    fill="#faf6f0"
                    fontSize="10"
                    fontWeight="800"
                    textAnchor="middle"
                    x="210"
                    y="114"
                  >
                    지금 문장
                  </text>
                  {networkResults.map((result, index) => {
                    const angle =
                      (Math.PI * 2 * index) / networkResults.length - Math.PI / 2;
                    const x = 210 + Math.cos(angle) * 135;
                    const y = 110 + Math.sin(angle) * 78;
                    const radius = clamp(10 + result.similarity * 16, 12, 26);

                    return (
                      <g
                        className="network-node"
                        key={result.chunkId}
                        onClick={() => openNetworkDetail(networkQueryChunk, result)}
                      >
                        <line
                          stroke="#5c4d3c"
                          strokeOpacity={0.18 + result.similarity * 0.42}
                          strokeWidth={1 + result.similarity * 2}
                          x1="210"
                          x2={x}
                          y1="110"
                          y2={y}
                        />
                        <circle
                          cx={x}
                          cy={y}
                          fill="#faf6f0"
                          r={radius}
                          stroke="#5c4d3c"
                          strokeWidth="1.2"
                        />
                        <text
                          fill="#2c2520"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          x={x}
                          y={y + 3}
                        >
                          {Math.round(result.similarity * 100)}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
            <div className="network-results">
              {networkResults.map(result => (
                <button
                  className="network-result"
                  key={result.chunkId}
                  onClick={() => openNetworkDetail(networkQueryChunk, result)}
                  type="button"
                >
                  <span>유사도 {Math.round(result.similarity * 100)}%</span>
                  <strong>{result.chunkText}</strong>
                  <p>{truncate(result.memoContent, 130)}</p>
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
              <div className="topic-relation-view">
                {isRelationFallback && (
                  <p className="topic-relation-note">
                    정밀 edge batch 전이라 membership 점수 기반으로 임시 연결을 보여줍니다.
                  </p>
                )}
                <svg role="img" viewBox="0 0 520 340">
                  <circle
                    cx="260"
                    cy="170"
                    fill="#faf6f0"
                    r="30"
                    stroke="#d8cebc"
                    strokeWidth="1.2"
                  />
                  <text
                    fill="#2c2520"
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle"
                    x="260"
                    y="174"
                  >
                    {truncate(selectedTopic.label, 10)}
                  </text>
                  {relationEdges.map((edge, edgeIndex) => {
                    const sourceIndex = selectedTopicRows.findIndex(
                      row => row.memo.id === edge.sourceMemoId,
                    );
                    const targetIndex = selectedTopicRows.findIndex(
                      row => row.memo.id === edge.targetMemoId,
                    );

                    if (sourceIndex < 0 || targetIndex < 0) {
                      return null;
                    }

                    const total = Math.max(selectedTopicRows.length, 1);
                    const sourceAngle = (Math.PI * 2 * sourceIndex) / total - Math.PI / 2;
                    const targetAngle = (Math.PI * 2 * targetIndex) / total - Math.PI / 2;
                    const sourceX = 260 + Math.cos(sourceAngle) * 130;
                    const sourceY = 170 + Math.sin(sourceAngle) * 104;
                    const targetX = 260 + Math.cos(targetAngle) * 130;
                    const targetY = 170 + Math.sin(targetAngle) * 104;

                    return (
                      <line
                        key={`${edge.sourceMemoId}-${edge.targetMemoId}-${edgeIndex}`}
                        stroke="#5c4d3c"
                        strokeOpacity={0.12 + edge.similarity * 0.45}
                        strokeWidth={0.8 + edge.similarity * 2.8}
                        x1={sourceX}
                        x2={targetX}
                        y1={sourceY}
                        y2={targetY}
                      />
                    );
                  })}
                  {selectedTopicRows.map(({ memo, score }, index) => {
                    const total = Math.max(selectedTopicRows.length, 1);
                    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
                    const x = 260 + Math.cos(angle) * 130;
                    const y = 170 + Math.sin(angle) * 104;
                    const radius = clamp(13 + score * 12, 14, 26);

                    return (
                      <g
                        className="topic-node"
                        key={memo.id}
                        onClick={() => {
                          onSelectMemo(memo);
                          setSelectedTopicId(null);
                        }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          fill="#faf6f0"
                          r={radius}
                          stroke={memo.id === activeMemoId ? '#236b45' : '#5c4d3c'}
                          strokeWidth={memo.id === activeMemoId ? 2 : 1.2}
                        />
                        <text
                          fill="#2c2520"
                          fontSize="9"
                          fontWeight="750"
                          textAnchor="middle"
                          x={x}
                          y={y + 3}
                        >
                          {truncate(getMemoTitle(memo), 7)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
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
                <span>과거의 유사 문장</span>
                <p>{networkDetail.result.chunkText}</p>
              </article>
            </div>
            <HighlightedMemo result={networkDetail.result} />
            <div className="sheet-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  onSelectMemoById(networkDetail.result.memoId);
                  setNetworkDetail(null);
                }}
                type="button"
              >
                이 메모로 이동
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default MemoWorkspace;
