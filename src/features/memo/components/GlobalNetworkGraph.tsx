import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

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
  TopicMembership,
} from '../../../services/supabase/topicService';
import { Memo, useMemoStore } from '../../../store/useMemoStore';

const CATEGORY_LABELS: Record<string, string> = {
  Work: '업무',
  Life: '일상',
  Todo: '할 일',
  Misc: '기타',
  Ideas: '아이디어',
};

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

interface GlobalNetworkGraphProps {
  activeMemoId: string | null;
  onSelectCategory: (category: string) => void;
  onSelectMemo: (memo: Memo) => void;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
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
      radius: Math.min(38, Math.max(22, 18 + count * 3)),
      representativeMemoId: undefined,
    };
  });

  return buildOrbitNodes(baseNodes, centerX, centerY);
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
  memberships,
  memos,
}: {
  activeMemoId: string | null;
  centerX: number;
  centerY: number;
  clusters: TopicCluster[];
  filterKey: TopicTimeFilterKey;
  memberships: TopicMembership[];
  memos: Memo[];
}) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));
  const cutoff = getFilterCutoff(filterKey);

  const baseNodes: Array<Omit<GraphNode, 'x' | 'y'>> = [];

  clusters.forEach(cluster => {
    const topicMemberships = memberships.filter(
      membership => membership.topicId === cluster.id,
    );
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
    const confidenceBoost = cluster.confidence ? cluster.confidence * 4 : 0;
    const radius = clamp(
      TOPIC_NODE_MIN_RADIUS + visibleCount * 4 + confidenceBoost,
      TOPIC_NODE_MIN_RADIUS,
      TOPIC_NODE_MAX_RADIUS,
    );

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

const GlobalNetworkGraph = ({
  activeMemoId,
  onSelectCategory,
  onSelectMemo,
}: GlobalNetworkGraphProps) => {
  const { width, height } = useWindowDimensions();
  const memos = useMemoStore(state => state.memos);
  const [filterKey, setFilterKey] = useState<TopicTimeFilterKey>(
    DEFAULT_TOPIC_TIME_FILTER,
  );
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [memberships, setMemberships] = useState<TopicMembership[]>([]);
  const [hasLoadedTopics, setHasLoadedTopics] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnims = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    let isMounted = true;

    fetchTopicMap()
      .then(data => {
        if (!isMounted) {
          return;
        }
        setClusters(data.clusters);
        setMemberships(data.memberships);
      })
      .catch(() => {
        if (isMounted) {
          setClusters([]);
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

  const svgWidth = Math.min(width - 32, 420);
  const svgHeight = Math.min(height * 0.55, 420);
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  const topicNodes = useMemo(
    () =>
      buildTopicNodes({
        activeMemoId,
        centerX,
        centerY,
        clusters,
        filterKey,
        memberships,
        memos,
      }),
    [activeMemoId, centerX, centerY, clusters, filterKey, memberships, memos],
  );
  const isTopicMode = topicNodes.length > 0;
  const nodes = useMemo(
    () =>
      isTopicMode
        ? topicNodes
        : buildCategoryNodes(categories, centerX, centerY),
    [categories, centerX, centerY, isTopicMode, topicNodes],
  );

  while (floatAnims.length < nodes.length) {
    floatAnims.push(new Animated.Value(0));
  }

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    nodes.forEach((_, index) => {
      const anim = floatAnims[index];
      const duration = 2400 + index * 300;

      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [fadeAnim, floatAnims, nodes]);

  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {hasLoadedTopics
            ? '메모를 작성하면 무의식 지도가 생성됩니다'
            : '무의식 지도를 불러오는 중입니다'}
        </Text>
      </View>
    );
  }

  const handleSelectNode = (node: GraphNode) => {
    if (isTopicMode && node.representativeMemoId) {
      const targetMemo = memos.find(memo => memo.id === node.representativeMemoId);
      if (targetMemo) {
        onSelectMemo(targetMemo);
      }
      return;
    }

    if (node.category) {
      onSelectCategory(node.category);
    }
  };

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

      <View style={styles.graphShell}>
        <Svg width={svgWidth} height={svgHeight}>
          {nodes.map(node => (
            <Line
              key={`line-${node.id}`}
              stroke="#D8D4CB"
              strokeOpacity={node.opacity}
              strokeWidth={node.isActiveLinked ? 1.4 : 0.8}
              strokeDasharray="4,4"
              x1={centerX}
              y1={centerY}
              x2={node.x}
              y2={node.y}
            />
          ))}

          <Circle
            cx={centerX}
            cy={centerY}
            r={28}
            fill="#FAF6F0"
            stroke="#D8CEBC"
            strokeWidth={1.2}
          />
          <SvgText
            fill="#2C2520"
            fontSize="11"
            fontWeight="800"
            textAnchor="middle"
            x={centerX}
            y={centerY + 4}
          >
            무의식
          </SvgText>

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

        {nodes.map((node, index) => {
          const floatY = floatAnims[index]?.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -6],
          });

          return (
            <Animated.View
              key={`touch-${node.id}`}
              style={[
                styles.touchNode,
                {
                  left: node.x - node.radius,
                  top: node.y - node.radius,
                  width: node.radius * 2,
                  height: node.radius * 2,
                  borderRadius: node.radius,
                  transform: [{ translateY: floatY ?? 0 }],
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
            </Animated.View>
          );
        })}
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
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
});

export default GlobalNetworkGraph;
