import type { InboxSession } from '../../services/backend/inboxService';
import type {
  MemoRow,
  MemoSimilarityEdge,
  TopicCluster,
  TopicInboxMembership,
  TopicMemoInboxEdge,
  TopicMembership,
} from '../../types';
import { localize } from '../../lib/uiLanguage';
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './components/KnowledgeGraphView';
import {
  capCrossTopicBridges,
  capIntraTopicEdges,
  GRAPH_INBOX_NODE,
  GRAPH_NODE_COLOR,
  LINK_NODE_ICON,
  NOTE_NODE_ICON,
} from './components/knowledgeGraph';
const TOPIC_GRAPH_MEMO_NODE_LIMIT = 32;
const TOPIC_BRIDGE_EDGE_LIMIT = 2;
const TOPIC_INTRA_EDGE_TOP_K = 3;
const TOPIC_INTRA_EDGE_MIN_SIMILARITY = 0.45;

export const TOPIC_COLORS = [
  '#8f8ee0',
  '#5cb84d',
  '#d1502c',
  '#b8892b',
  '#4aa5a5',
  '#c04f7a',
  '#3d7dbf',
  '#7b6240',
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getGraphMemoTitle = (
  memo: MemoRow,
  language: 'en' | 'ko',
  limit = 13,
) => {
  const title =
    memo.content
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) ?? localize(language, '제목 없는 노트', 'Untitled note');
  return title.length > limit ? `${title.slice(0, limit).trimEnd()}...` : title;
};

const getGraphInboxTitle = (
  item: InboxSession,
  language: 'en' | 'ko',
  limit = 13,
) => {
  const title =
    item.title ??
    item.domain ??
    localize(language, '저장한 링크', 'Saved link');
  return title.length > limit ? `${title.slice(0, limit).trimEnd()}...` : title;
};

export const buildSplitTopicGraph = (
  clusters: TopicCluster[],
  memberships: TopicMembership[],
  globalEdges: MemoSimilarityEdge[],
  memos: MemoRow[],
  activeMemoId: string | null | undefined,
  inboxMemberships: TopicInboxMembership[] = [],
  inboxEdges: TopicMemoInboxEdge[] = [],
  inboxItems: InboxSession[] = [],
  language: 'en' | 'ko',
) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));
  const inboxItemById = new Map(inboxItems.map(item => [item.id, item]));
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const total = Math.max(clusters.length, 1);
  const topicRing = 1.4 + total * 0.18;
  const memoNodeIds = new Set<string>();

  clusters.forEach((cluster, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    memberships
      .filter(item => item.topicId === cluster.id)
      .map(membership => ({
        memo: memoById.get(membership.memoId),
        score: membership.score ?? 0.5,
      }))
      .filter((row): row is { memo: MemoRow; score: number } =>
        Boolean(row.memo),
      )
      .sort((a, b) =>
        a.memo.id === activeMemoId
          ? -1
          : b.memo.id === activeMemoId
            ? 1
            : b.score - a.score,
      )
      .slice(0, TOPIC_GRAPH_MEMO_NODE_LIMIT)
      .forEach(({ memo, score }, memoIndex, memoRows) => {
        const memoAngle =
          (Math.PI * 2 * memoIndex) / Math.max(memoRows.length, 1);
        const memoOrbit = 0.18 + memoRows.length * 0.02;
        const memoNodeId = `memo:${memo.id}`;
        nodes.push({
          color: memo.id === activeMemoId ? '#1d1d1f' : GRAPH_NODE_COLOR,
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
        memoNodeIds.add(memoNodeId);
      });
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
        nodes.push({
          color: GRAPH_INBOX_NODE,
          id: `inbox:${item.id}`,
          image: LINK_NODE_ICON,
          label: getGraphInboxTitle(item, language),
          size: clamp(4.5 + score * 4, 5, 9),
          topicId: cluster.id,
          x: Math.cos(angle) * topicRing + Math.cos(inboxAngle) * 0.3,
          y: Math.sin(angle) * topicRing + Math.sin(inboxAngle) * 0.3,
        });
      });
  });

  capCrossTopicBridges(
    capIntraTopicEdges(
      globalEdges,
      TOPIC_INTRA_EDGE_TOP_K,
      TOPIC_INTRA_EDGE_MIN_SIMILARITY,
    ),
    TOPIC_BRIDGE_EDGE_LIMIT,
  ).forEach((edge, index) => {
    const source = `memo:${edge.sourceMemoId}`;
    const target = `memo:${edge.targetMemoId}`;
    if (!memoNodeIds.has(source) || !memoNodeIds.has(target)) return;
    const isIntraTopic =
      Boolean(edge.sourceTopicId) && edge.sourceTopicId === edge.targetTopicId;
    edges.push({
      color: isIntraTopic ? '#bcb8b0' : '#c8beb0',
      id: `split-global-memo-edge-${edge.sourceMemoId}-${edge.targetMemoId}-${index}`,
      size: isIntraTopic ? undefined : 0.35 + edge.similarity * 0.45,
      source,
      target,
      weight: edge.similarity,
    });
  });
  inboxEdges.forEach((edge, index) => {
    const source = `memo:${edge.memoId}`;
    const target = `inbox:${edge.inboxSessionId}`;
    if (!memoNodeIds.has(source) || !nodes.some(node => node.id === target))
      return;
    edges.push({
      color: '#c8beb0',
      id: `split-memo-inbox-edge-${edge.memoId}-${edge.inboxSessionId}-${index}`,
      size: 0.35 + edge.similarity * 0.45,
      source,
      target,
      weight: edge.similarity,
    });
  });
  return { edges, nodes };
};

export type SplitTopicGraph = ReturnType<typeof buildSplitTopicGraph>;
