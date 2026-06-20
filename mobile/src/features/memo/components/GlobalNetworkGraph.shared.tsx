import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import PlatformModal from '../../../components/PlatformModal';
import {
  DEFAULT_TOPIC_TIME_FILTER,
  TOPIC_NODE_ACTIVE_BOOST,
  TOPIC_NODE_MAX_OPACITY,
  TOPIC_NODE_MAX_RADIUS,
  TOPIC_NODE_MIN_OPACITY,
  TOPIC_NODE_MIN_RADIUS,
  TOPIC_TIME_FILTERS,
  TopicTimeFilterKey,
} from '../../../lib/constants';
import {
  fetchTopicMap,
  TopicCluster,
  TopicMemoEdge,
  TopicMembership,
} from '../../network/services/topicService';
import { Memo, useMemoStore } from '../../../store/useMemoStore';

const CATEGORY_LABELS: Record<string, string> = {
  Work: '업무',
  Life: '일상',
  Todo: '할 일',
  Misc: '기타',
  Ideas: '아이디어',
  MiniSubnota: 'Mini Subnota',
};

type TopicDetailMode = 'quick' | 'relation';

interface GraphNode {
  category?: string;
  count: number;
  id: string;
  isActiveLinked: boolean;
  label: string;
  opacity: number;
  radius: number;
  representativeMemoId?: string;
  x: number;
  y: number;
}

interface TopicMemoRow {
  memo: Memo;
  score: number;
}

export interface GlobalNetworkGraphProps {
  activeMemoId: string | null;
  onSelectCategory: (category: string) => void;
  onSelectMemo: (memo: Memo) => void;
}

export interface GlobalNetworkGraphPlatformConfig {
  getSvgHeight: (windowHeight: number) => number;
  getSvgWidth: (windowWidth: number) => number;
  nodeScale: number;
}

export const defaultGlobalNetworkGraphConfig: GlobalNetworkGraphPlatformConfig = {
  getSvgHeight: windowHeight => Math.min(windowHeight * 0.55, 420),
  getSvgWidth: windowWidth => Math.min(windowWidth - 32, 420),
  nodeScale: 1,
};

interface GlobalNetworkGraphSharedProps extends GlobalNetworkGraphProps {
  platformConfig: GlobalNetworkGraphPlatformConfig;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const safeSvgSize = (value: number, min: number, max: number) => {
  const safeMax = Math.max(min, Number.isFinite(max) ? max : min);
  const safeValue = Number.isFinite(value) ? value : min;

  return clamp(safeValue, min, safeMax);
};

const truncateLabel = (label: string) => {
  return label.length > 12 ? `${label.slice(0, 12)}...` : label;
};

const buildOrbitNodes = (
  nodes: Array<Omit<GraphNode, 'x' | 'y'>>,
  centerX: number,
  centerY: number,
): GraphNode[] => {
  const orbitRadius = Math.min(centerX, centerY) * 0.56;
  const total = Math.max(nodes.length, 1);

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / total - Math.PI / 2;

    return {
      ...node,
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
    };
  });
};

const buildCategoryNodes = (
  categories: Record<string, number>,
  centerX: number,
  centerY: number,
  nodeScale: number,
): GraphNode[] => {
  const baseNodes = Object.keys(categories).map(category => {
    const count = categories[category];

    return {
      category,
      count,
      id: `category-${category}`,
      isActiveLinked: false,
      label: CATEGORY_LABELS[category] ?? category,
      opacity: TOPIC_NODE_MAX_OPACITY,
      radius: Math.min(
        TOPIC_NODE_MAX_RADIUS,
        Math.max(TOPIC_NODE_MIN_RADIUS, TOPIC_NODE_MIN_RADIUS + count * 1.5),
      ) * nodeScale,
      representativeMemoId: undefined,
    };
  });

  return buildOrbitNodes(baseNodes, centerX, centerY);
};

const getMemoTitle = (memo: Memo, limit = 18) => {
  const title =
    memo.content
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '새 노트';

  return title.length > limit ? `${title.slice(0, limit).trimEnd()}...` : title;
};

const getMemoPreview = (memo: Memo, limit = 64) => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const preview = lines[1] ?? lines[0] ?? '내용 없음';

  return preview.length > limit ? `${preview.slice(0, limit).trimEnd()}...` : preview;
};

const getTopicMemoRows = ({
  memberships,
  memos,
}: {
  memberships: TopicMembership[];
  memos: Memo[];
}): TopicMemoRow[] => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));

  return memberships
    .map(membership => {
      const memo = memoById.get(membership.memoId);

      return memo ? { memo, score: membership.score ?? 0.5 } : null;
    })
    .filter((row): row is TopicMemoRow => Boolean(row))
    .sort((a, b) => b.score - a.score);
};

const buildFallbackTopicEdges = (rows: TopicMemoRow[]): TopicMemoEdge[] => {
  const edges: TopicMemoEdge[] = [];

  rows.slice(1).forEach((row, index) => {
    const source = rows[0];
    const previous = rows[index];

    edges.push({
      similarity: clamp((source.score + row.score) / 2, 0.35, 0.92),
      sourceMemoId: source.memo.id,
      targetMemoId: row.memo.id,
      topicId: '',
    });

    if (previous && previous.memo.id !== source.memo.id) {
      edges.push({
        similarity: clamp((previous.score + row.score) / 2, 0.28, 0.82),
        sourceMemoId: previous.memo.id,
        targetMemoId: row.memo.id,
        topicId: '',
      });
    }
  });

  return edges;
};

const getFilterCutoff = (filterKey: TopicTimeFilterKey) => {
  const filter = TOPIC_TIME_FILTERS.find(item => item.key === filterKey);

  if (!filter?.days) {
    return null;
  }

  return Date.now() - filter.days * 24 * 60 * 60 * 1000;
};

const buildTopicNodes = ({
  activeMemoId,
  centerX,
  centerY,
  clusters,
  filterKey,
  membershipsByTopic,
  memos,
  nodeScale,
}: {
  activeMemoId: string | null;
  centerX: number;
  centerY: number;
  clusters: TopicCluster[];
  filterKey: TopicTimeFilterKey;
  membershipsByTopic: Map<string, TopicMembership[]>;
  memos: Memo[];
  nodeScale: number;
}) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));
  const cutoff = getFilterCutoff(filterKey);

  const baseNodes: Array<Omit<GraphNode, 'x' | 'y'>> = [];

  clusters.forEach(cluster => {
    if (cluster.label === '무의식' || cluster.id === 'unconscious') {
      return;
    }
    const topicMemberships = membershipsByTopic.get(cluster.id) ?? [];
    const topicMemos = topicMemberships
      .map(membership => memoById.get(membership.memoId))
      .filter((memo): memo is Memo => Boolean(memo));
    const filteredMemos = cutoff
      ? topicMemos.filter(
        memo => Math.max(memo.updatedAt, memo.createdAt) >= cutoff,
      )
      : topicMemos;
    const isActiveLinked = Boolean(
      activeMemoId &&
      topicMemberships.some(membership => membership.memoId === activeMemoId),
    );

    if (filteredMemos.length === 0 && !isActiveLinked) {
      return;
    }

    const newestTimestamp = topicMemos.reduce(
      (latest, memo) => Math.max(latest, memo.updatedAt, memo.createdAt),
      0,
    );
    const ageDays = newestTimestamp
      ? Math.floor((Date.now() - newestTimestamp) / (24 * 60 * 60 * 1000))
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
    const visibleCount = Math.max(filteredMemos.length, isActiveLinked ? 1 : 0);
    const confidenceBoost = cluster.confidence ? cluster.confidence * 1.5 : 0;
    const radius = clamp(
      TOPIC_NODE_MIN_RADIUS + visibleCount * 1.5 + confidenceBoost,
      TOPIC_NODE_MIN_RADIUS,
      TOPIC_NODE_MAX_RADIUS,
    ) * nodeScale;

    baseNodes.push({
      count: visibleCount,
      id: cluster.id,
      isActiveLinked,
      label: truncateLabel(cluster.label),
      opacity,
      radius,
      representativeMemoId:
        cluster.representativeMemoIds.find(id => memoById.has(id)) ??
        filteredMemos[0]?.id ??
        topicMemos[0]?.id,
    });
  });

  return buildOrbitNodes(baseNodes, centerX, centerY);
};

export const groupByTopic = <T extends { topicId: string }>(items: T[]) => {
  const grouped = new Map<string, T[]>();

  items.forEach(item => {
    const topicItems = grouped.get(item.topicId);
    if (topicItems) {
      topicItems.push(item);
    } else {
      grouped.set(item.topicId, [item]);
    }
  });

  return grouped;
};

const GlobalNetworkGraphShared = ({
  activeMemoId,
  onSelectCategory,
  onSelectMemo,
  platformConfig,
}: GlobalNetworkGraphSharedProps) => {
  const { width, height } = useWindowDimensions();
  const memos = useMemoStore(state => state.memos);
  const [filterKey, setFilterKey] = useState<TopicTimeFilterKey>(
    DEFAULT_TOPIC_TIME_FILTER,
  );
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [detailMode, setDetailMode] = useState<TopicDetailMode>('quick');
  const [edges, setEdges] = useState<TopicMemoEdge[]>([]);
  const [memberships, setMemberships] = useState<TopicMembership[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [hasLoadedTopics, setHasLoadedTopics] = useState(false);
  const [graphLayout, setGraphLayout] = useState({ width: 0, height: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    fetchTopicMap()
      .then(data => {
        if (!isMounted) {
          return;
        }
        setClusters(data.clusters);
        setEdges(data.edges);
        setMemberships(data.memberships);
      })
      .catch(() => {
        if (isMounted) {
          setClusters([]);
          setEdges([]);
          setMemberships([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setHasLoadedTopics(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};

    memos
      .filter(m => m.content.trim())
      .forEach(memo => {
        const cat = memo.category || 'Ideas';
        counts[cat] = (counts[cat] ?? 0) + 1;
      });

    return counts;
  }, [memos]);

  const graphAvailableWidth = graphLayout.width > 0 ? graphLayout.width : width;
  const graphAvailableHeight = graphLayout.height > 0 ? graphLayout.height : height;
  const svgWidth = safeSvgSize(
    platformConfig.getSvgWidth(graphAvailableWidth),
    220,
    graphAvailableWidth - 16,
  );
  const svgHeight = safeSvgSize(
    platformConfig.getSvgHeight(graphAvailableHeight),
    220,
    graphAvailableHeight - 16,
  );
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const membershipsByTopic = useMemo(
    () => groupByTopic(memberships),
    [memberships],
  );
  const edgesByTopic = useMemo(() => groupByTopic(edges), [edges]);

  const topicNodes = useMemo(
    () =>
      buildTopicNodes({
        activeMemoId,
        centerX,
        centerY,
        clusters,
        filterKey,
        membershipsByTopic,
        memos,
        nodeScale: platformConfig.nodeScale,
      }),
    [
      activeMemoId,
      centerX,
      centerY,
      clusters,
      filterKey,
      membershipsByTopic,
      memos,
      platformConfig.nodeScale,
    ],
  );
  const isTopicMode = topicNodes.length > 0;
  const nodes = useMemo(
    () =>
      isTopicMode
        ? topicNodes
        : buildCategoryNodes(
          categories,
          centerX,
          centerY,
          platformConfig.nodeScale,
        ),
    [categories, centerX, centerY, isTopicMode, platformConfig.nodeScale, topicNodes],
  );
  const selectedTopic = useMemo(
    () => clusters.find(cluster => cluster.id === selectedTopicId) ?? null,
    [clusters, selectedTopicId],
  );
  const selectedTopicRows = useMemo(
    () =>
      selectedTopic
        ? getTopicMemoRows({
        memberships: membershipsByTopic.get(selectedTopic.id) ?? [],
        memos,
      })
        : [],
    [membershipsByTopic, memos, selectedTopic],
  );
  const selectedTopicEdges = useMemo(
    () =>
      selectedTopic
        ? edgesByTopic.get(selectedTopic.id) ?? []
        : [],
    [edgesByTopic, selectedTopic],
  );
  const relationEdges = useMemo(
    () =>
      selectedTopicEdges.length > 0
        ? selectedTopicEdges
        : buildFallbackTopicEdges(selectedTopicRows),
    [selectedTopicEdges, selectedTopicRows],
  );
  const isRelationFallback = selectedTopicEdges.length === 0;

  useEffect(() => {
    const fadeAnimation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    });

    fadeAnimation.start();

    return () => {
      fadeAnimation.stop();
    };
  }, [fadeAnim]);

  const handleGraphLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: nextHeight, width: nextWidth } = event.nativeEvent.layout;

    setGraphLayout(previous => {
      if (
        Math.abs(previous.width - nextWidth) < 1 &&
        Math.abs(previous.height - nextHeight) < 1
      ) {
        return previous;
      }

      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  const handleSelectNode = useCallback((node: GraphNode) => {
    if (isTopicMode) {
      setSelectedTopicId(node.id);
      setDetailMode('quick');
      return;
    }

    if (node.category) {
      onSelectCategory(node.category);
    }
  }, [isTopicMode, onSelectCategory]);
  const detailSvgWidth = safeSvgSize(Math.min(width - 64, 420), 220, 420);
  const detailSvgHeight = 300;
  const detailCenterX = detailSvgWidth / 2;
  const detailCenterY = detailSvgHeight / 2;
  const detailMemoNodes = useMemo(() => {
    const total = Math.max(selectedTopicRows.length, 1);
    const orbit = Math.min(detailCenterX, detailCenterY) * 0.72;

    return selectedTopicRows.map((row, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const x = detailCenterX + Math.cos(angle) * orbit;
      const y = detailCenterY + Math.sin(angle) * orbit;
      const radius = clamp(13 + row.score * 12, 14, 26);

      return { radius, row, x, y };
    });
  }, [detailCenterX, detailCenterY, selectedTopicRows]);
  const detailMemoNodeByMemoId = useMemo(
    () => new Map(detailMemoNodes.map(node => [node.row.memo.id, node])),
    [detailMemoNodes],
  );

  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {hasLoadedTopics
            ? '노트를 작성하면 무의식 지도가 생성됩니다'
            : '무의식 지도를 불러오는 중입니다'}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {isTopicMode && (
        <View style={styles.filterRow}>
          {TOPIC_TIME_FILTERS.map(filter => (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              onPress={() => setFilterKey(filter.key)}
              style={[
                styles.filterButton,
                filterKey === filter.key && styles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filterKey === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.graphShell} onLayout={handleGraphLayout}>
        <View style={{ width: svgWidth, height: svgHeight, position: 'relative' }}>
          <Svg width={svgWidth} height={svgHeight}>




            {nodes.map(node => (
              <React.Fragment key={node.id}>
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill="#FAF6F0"
                  fillOpacity={node.opacity}
                  stroke={node.isActiveLinked ? '#236B45' : '#5C4D3C'}
                  strokeOpacity={node.opacity}
                  strokeWidth={node.isActiveLinked ? 2 : 1.4}
                />
                <SvgText
                  fill="#2C2520"
                  fillOpacity={node.opacity}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  x={node.x}
                  y={node.y - 2}
                >
                  {node.label}
                </SvgText>
                <SvgText
                  fill="#9C8E7C"
                  fillOpacity={node.opacity}
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  x={node.x}
                  y={node.y + 11}
                >
                  {`${node.count}개`}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>

          {nodes.map(node => (
            <View
              key={`touch-${node.id}`}
              style={[
                styles.touchNode,
                {
                  left: node.x - node.radius,
                  top: node.y - node.radius,
                  width: node.radius * 2,
                  height: node.radius * 2,
                  borderRadius: node.radius,
                },
              ]}
            >
              <Pressable
                accessibilityLabel={`${node.label} 노드`}
                accessibilityRole="button"
                onPress={() => handleSelectNode(node)}
                style={({ pressed }) => [
                  styles.touchPressable,
                  pressed && styles.touchPressed,
                ]}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        {nodes.map(node => (
          <Pressable
            key={node.id}
            onPress={() => handleSelectNode(node)}
            style={({ pressed }) => [
              styles.legendItem,
              node.isActiveLinked && styles.legendItemActive,
              pressed && styles.legendItemPressed,
            ]}
          >
            <View
              style={[
                styles.legendDot,
                node.isActiveLinked && styles.legendDotActive,
                { opacity: node.opacity },
              ]}
            />
            <Text style={[styles.legendText, { opacity: node.opacity }]}>
              {node.label} ({node.count})
            </Text>
          </Pressable>
        ))}
      </View>

      <PlatformModal
        animationType="fade"
        onRequestClose={() => setSelectedTopicId(null)}
        transparent
        visible={Boolean(selectedTopic)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.topicDetailPanel}>
            <View style={styles.topicDetailHeader}>
              <View>
                <Text style={styles.topicDetailEyebrow}>Topic Detail</Text>
                <Text style={styles.topicDetailTitle}>
                  {selectedTopic?.label ?? '무의식'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedTopicId(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.detailSegment}>
              {(['quick', 'relation'] as TopicDetailMode[]).map(mode => (
                <Pressable
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: detailMode === mode }}
                  onPress={() => setDetailMode(mode)}
                  style={[
                    styles.detailSegmentButton,
                    detailMode === mode && styles.detailSegmentButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.detailSegmentText,
                      detailMode === mode && styles.detailSegmentTextActive,
                    ]}
                  >
                    {mode === 'quick' ? '빠른 보기' : '관계 보기'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {detailMode === 'quick' ? (
              <ScrollView
                contentContainerStyle={styles.quickMemoList}
                showsVerticalScrollIndicator={false}
              >
                {selectedTopicRows.length === 0 && (
                  <Text style={styles.emptyText}>
                    이 topic에 연결된 로컬 노트가 없습니다.
                  </Text>
                )}
                {selectedTopicRows.map((row, index) => (
                  <Pressable
                    key={row.memo.id}
                    accessibilityRole="button"
                    onPress={() => {
                      onSelectMemo(row.memo);
                      setSelectedTopicId(null);
                    }}
                    style={({ pressed }) => [
                      styles.quickMemoCard,
                      pressed && styles.quickMemoCardPressed,
                    ]}
                  >
                    <Text style={styles.quickMemoMeta}>
                      {index === 0
                        ? '대표 후보'
                        : `연결 점수 ${Math.round(row.score * 100)}%`}
                    </Text>
                    <Text style={styles.quickMemoTitle} numberOfLines={1}>
                      {getMemoTitle(row.memo, 28)}
                    </Text>
                    <Text style={styles.quickMemoPreview} numberOfLines={2}>
                      {getMemoPreview(row.memo)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.relationShell}>
                {isRelationFallback && (
                  <Text style={styles.relationNote}>
                    정밀 edge batch 전이라 membership 점수 기반으로 임시 연결을 보여줍니다.
                  </Text>
                )}
                <View
                  style={[
                    styles.relationGraphCanvas,
                    { height: detailSvgHeight, width: detailSvgWidth },
                  ]}
                >
                  <Svg width={detailSvgWidth} height={detailSvgHeight}>
                    <Circle
                      cx={detailCenterX}
                      cy={detailCenterY}
                      r={30}
                      fill="#FAF6F0"
                      stroke="#D8CEBC"
                      strokeWidth={1.2}
                    />
                    <SvgText
                      fill="#2C2520"
                      fontSize="11"
                      fontWeight="800"
                      textAnchor="middle"
                      x={detailCenterX}
                      y={detailCenterY + 4}
                    >
                      {selectedTopic ? truncateLabel(selectedTopic.label) : '무의식'}
                    </SvgText>

                    {relationEdges.map((edge, edgeIndex) => {
                      const sourceNode = detailMemoNodeByMemoId.get(edge.sourceMemoId);
                      const targetNode = detailMemoNodeByMemoId.get(edge.targetMemoId);

                      if (!sourceNode || !targetNode) {
                        return null;
                      }

                      return (
                        <Line
                          key={`${edge.sourceMemoId}-${edge.targetMemoId}-${edgeIndex}`}
                          stroke="#5C4D3C"
                          strokeOpacity={0.12 + edge.similarity * 0.45}
                          strokeWidth={0.8 + edge.similarity * 2.8}
                          x1={sourceNode.x}
                          x2={targetNode.x}
                          y1={sourceNode.y}
                          y2={targetNode.y}
                        />
                      );
                    })}

                    {detailMemoNodes.map(({ radius, row, x, y }) => (
                      <React.Fragment key={row.memo.id}>
                        <Circle
                          cx={x}
                          cy={y}
                          r={radius}
                          fill="#FAF6F0"
                          stroke={row.memo.id === activeMemoId ? '#236B45' : '#5C4D3C'}
                          strokeWidth={row.memo.id === activeMemoId ? 2 : 1.2}
                        />
                        <SvgText
                          fill="#2C2520"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          x={x}
                          y={y + 3}
                        >
                          {getMemoTitle(row.memo, 7)}
                        </SvgText>
                      </React.Fragment>
                    ))}
                  </Svg>

                  {detailMemoNodes.map(({ radius, row, x, y }) => (
                    <Pressable
                      key={`relation-touch-${row.memo.id}`}
                      accessibilityLabel={`${getMemoTitle(row.memo, 18)} 열기`}
                      accessibilityRole="button"
                      onPress={() => {
                        onSelectMemo(row.memo);
                        setSelectedTopicId(null);
                      }}
                      style={({ pressed }) => [
                        styles.relationTouchNode,
                        {
                          borderRadius: radius + 8,
                          height: (radius + 8) * 2,
                          left: x - radius - 8,
                          top: y - radius - 8,
                          width: (radius + 8) * 2,
                        },
                        pressed && styles.touchPressed,
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </PlatformModal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#9C8E7C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  filterButton: {
    borderColor: '#E5DDD0',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterButtonActive: {
    backgroundColor: '#EDE6D8',
  },
  filterText: {
    color: '#9C8E7C',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#2C2520',
  },
  graphShell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  touchNode: {
    position: 'absolute',
  },
  touchPressable: {
    flex: 1,
  },
  touchPressed: {
    opacity: 0.6,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  legendItem: {
    alignItems: 'center',
    borderColor: '#E5DDD0',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginHorizontal: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendItemActive: {
    borderColor: '#BBDDC5',
  },
  legendItemPressed: {
    backgroundColor: '#EDE6D8',
  },
  legendDot: {
    backgroundColor: '#5C4D3C',
    borderRadius: 3,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  legendDotActive: {
    backgroundColor: '#236B45',
  },
  legendText: {
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  topicDetailPanel: {
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '84%',
    maxWidth: 460,
    padding: 16,
    width: '100%',
  },
  topicDetailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topicDetailEyebrow: {
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '800',
  },
  topicDetailTitle: {
    color: '#2C2520',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  closeButton: {
    borderColor: '#E5DDD0',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#5C4D3C',
    fontSize: 13,
    fontWeight: '800',
  },
  detailSegment: {
    backgroundColor: '#EDE6D8',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    marginBottom: 12,
    padding: 3,
  },
  detailSegmentButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
  },
  detailSegmentButtonActive: {
    backgroundColor: '#FAF6F0',
  },
  detailSegmentText: {
    color: '#8B7355',
    fontSize: 12,
    fontWeight: '800',
  },
  detailSegmentTextActive: {
    color: '#2C2520',
  },
  quickMemoList: {
    gap: 8,
    paddingBottom: 6,
  },
  quickMemoCard: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  quickMemoCardPressed: {
    backgroundColor: '#EDE6D8',
  },
  quickMemoMeta: {
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  quickMemoTitle: {
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '800',
  },
  quickMemoPreview: {
    color: '#6C5F51',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 6,
  },
  relationShell: {
    alignItems: 'center',
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  relationGraphCanvas: {
    position: 'relative',
  },
  relationTouchNode: {
    position: 'absolute',
  },
  relationNote: {
    alignSelf: 'stretch',
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
});

export default React.memo(GlobalNetworkGraphShared);
