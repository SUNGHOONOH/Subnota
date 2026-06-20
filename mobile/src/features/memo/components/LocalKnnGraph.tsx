import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { MemoChunk } from '../../../lib/memoChunker';
import { NetworkSearchResult } from '../../network/services/networkService';

const MEMO_LABEL_LIMIT = 14;

const truncateLabel = (content: string, limit = MEMO_LABEL_LIMIT): string => {
  const firstLine = content
    .split('\n')
    .find(line => line.trim())
    ?.trim();
  const label = firstLine || '노트';

  if (label.length <= limit) {
    return label;
  }

  return `${label.slice(0, limit)}…`;
};

const formatSimilarity = (similarity: number): string => {
  const percent = Math.round(Math.max(0, Math.min(similarity, 1)) * 100);
  return `${percent}%`;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const safeSvgSize = (value: number, min: number, max: number): number => {
  const safeMax = Math.max(min, Number.isFinite(max) ? max : min);
  const safeValue = Number.isFinite(value) ? value : min;

  return clamp(safeValue, min, safeMax);
};

interface LocalKnnGraphProps {
  errorMessage?: string | null;
  isLoading: boolean;
  onNavigateToMemo: (memoId: string) => void;
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
}

interface KnnNode {
  id: string;
  label: string;
  memoId: string | null;
  x: number;
  y: number;
  radius: number;
  similarity: number;
  isCenter: boolean;
}

const LocalKnnGraph = ({
  errorMessage,
  isLoading,
  onNavigateToMemo,
  queryChunk,
  results,
}: LocalKnnGraphProps) => {
  const { width, height } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [graphLayout, setGraphLayout] = useState({ width: 0, height: 0 });
  const graphAvailableWidth = graphLayout.width > 0 ? graphLayout.width : width;
  const graphAvailableHeight = graphLayout.height > 0 ? graphLayout.height : height * 0.5;
  const svgWidth = safeSvgSize(
    Math.min(graphAvailableWidth - 24, 380),
    220,
    graphAvailableWidth - 16,
  );
  const svgHeight = safeSvgSize(
    Math.min(graphAvailableHeight - 24, 380),
    220,
    graphAvailableHeight - 16,
  );
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  const nodes: KnnNode[] = useMemo(() => {
    const result: KnnNode[] = [];

    if (queryChunk) {
      result.push({
        id: queryChunk.id,
        label: truncateLabel(queryChunk.text, 10),
        memoId: null,
        x: centerX,
        y: centerY,
        radius: 23,
        similarity: 1,
        isCenter: true,
      });
    }

    const count = results.length;
    const minOrbit = Math.min(centerX, centerY) * 0.35;
    const maxOrbit = Math.min(centerX, centerY) * 0.82;

    results.forEach((resultItem, index) => {
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      const similarity = Math.max(0, Math.min(resultItem.similarity, 1));
      // Proportions matching landing page mock: radius 6px to 18px (diameter 12px to 36px)
      const nodeRadius = Math.max(6, Math.min(18, 6 + Math.round((similarity - 0.4) * 25)));
      const distance = maxOrbit - similarity * (maxOrbit - minOrbit);

      result.push({
        id: resultItem.chunkId,
        label: resultItem.sourceKind === 'inbox'
          ? resultItem.sourceLabel ?? '수집함'
          : truncateLabel(resultItem.chunkText),
        memoId: resultItem.memoId,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        radius: nodeRadius,
        similarity,
        isCenter: false,
      });
    });

    return result;
  }, [centerX, centerY, queryChunk, results]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
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

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>현재 문장과 연결된 노트를 찾는 중입니다.</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!queryChunk || results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          연결된 문장이 아직 없습니다. 저녁 batch 이후 다시 확인해 주세요.
        </Text>
      </View>
    );
  }

  const centerNode = nodes.find(n => n.isCenter)!;
  const peripheralNodes = nodes.filter(n => !n.isCenter);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.graphShell} onLayout={handleGraphLayout}>
        <Svg width={svgWidth} height={svgHeight}>
          {/* Concentric gray orbits (solar system style) */}
          {[0.28, 0.56, 0.82].map((ratio, index) => {
            const orbitR = Math.min(centerX, centerY) * ratio;
            return (
              <Circle
                key={`orbit-${index}`}
                cx={centerX}
                cy={centerY}
                r={orbitR}
                fill="none"
                stroke="#5C4D3C"
                strokeWidth={1}
                strokeDasharray="4,4"
                strokeOpacity={0.20}
              />
            );
          })}

          {/* Similarity links: stronger matches are thicker and more opaque. */}
          {peripheralNodes.map(node => (
            <Line
              key={`line-${node.id}`}
              x1={centerNode.x}
              y1={centerNode.y}
              x2={node.x}
              y2={node.y}
              stroke="#5C4D3C"
              strokeLinecap="round"
              strokeOpacity={0.12 + node.similarity * 0.50}
              strokeWidth={0.5 + node.similarity * 3.2}
            />
          ))}

          {/* Center node */}
          <Circle
            cx={centerNode.x}
            cy={centerNode.y}
            r={centerNode.radius}
            fill="#5C4D3C"
            stroke="#5C4D3C"
            strokeWidth={1.5}
          />
          <SvgText
            fill="#FAF6F0"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            x={centerNode.x}
            y={centerNode.y + 3.5}
          >
            {centerNode.label.length > 8
              ? `${centerNode.label.slice(0, 8)}…`
              : centerNode.label}
          </SvgText>

          {/* Peripheral nodes */}
          {peripheralNodes.map(node => (
            <React.Fragment key={node.id}>
              <Circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill="#FAF6F0"
                opacity={0.40 + node.similarity * 0.60}
                stroke="#5C4D3C"
                strokeOpacity={0.35 + node.similarity * 0.65}
                strokeWidth={0.7 + node.similarity * 2.2}
              />
              <SvgText
                fill="#2C2520"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x={node.x}
                y={node.y + node.radius + 10}
              >
                {node.label.length > 10
                  ? `${node.label.slice(0, 10)}…`
                  : node.label}
              </SvgText>
              <SvgText
                fill="#8C7B69"
                fontSize="7"
                fontWeight="700"
                textAnchor="middle"
                x={node.x}
                y={node.y + node.radius + 20}
              >
                {formatSimilarity(node.similarity)}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>

        {/* Pressable overlays for peripheral nodes */}
        {peripheralNodes.map(node => (
          <Pressable
            key={`touch-${node.id}`}
            accessibilityLabel={`${node.label} 연결 열기`}
            accessibilityRole="button"
            onPress={() => {
              if (node.memoId) {
                onNavigateToMemo(node.memoId);
              }
            }}
            style={({ pressed }) => [
              styles.touchNode,
              {
                left: node.x - node.radius - 4,
                top: node.y - node.radius - 4,
                width: (node.radius + 4) * 2,
                height: (node.radius + 4) * 2,
                borderRadius: node.radius + 4,
              },
              pressed && styles.touchPressed,
            ]}
          />
        ))}
      </View>

      {/* Similarity hint */}
      <View style={styles.hintRow}>
        <View style={styles.hintLine}>
          <View style={styles.hintLineThin} />
          <Text style={styles.hintLabel}>약한 연결</Text>
        </View>
        <View style={styles.hintLine}>
          <View style={styles.hintLineThick} />
          <Text style={styles.hintLabel}>강한 연결</Text>
        </View>
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
  graphShell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  touchNode: {
    position: 'absolute',
  },
  touchPressed: {
    backgroundColor: 'rgba(92, 77, 60, 0.06)',
  },
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'center',
    paddingBottom: 20,
    paddingTop: 8,
  },
  hintLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  hintLineThin: {
    backgroundColor: '#5C4D3C',
    height: 1,
    opacity: 0.2,
    width: 24,
  },
  hintLineThick: {
    backgroundColor: '#5C4D3C',
    height: 3,
    opacity: 0.4,
    width: 24,
  },
  hintLabel: {
    color: '#9C8E7C',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default LocalKnnGraph;
