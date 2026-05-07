import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { useMemoStore } from '../../../store/useMemoStore';

const CATEGORY_COLOR: Record<string, string> = {
  Work: '#2F3437',
  Life: '#66705A',
  Todo: '#A75C4A',
  Misc: '#7A746B',
  Ideas: '#A75C4A',
};

const CENTER = { x: 180, y: 210 };
const CATEGORY_POINTS: Record<string, { x: number; y: number }> = {
  Work: { x: 96, y: 92 },
  Life: { x: 288, y: 144 },
  Todo: { x: 232, y: 308 },
  Misc: { x: 72, y: 230 },
  Ideas: { x: 140, y: 326 },
};

const MemoNetworkGraph = () => {
  const { width } = useWindowDimensions();
  const memos = useMemoStore(state => state.memos);

  const nodes = useMemo(() => {
    return memos.slice(0, 8).map((memo, index) => {
      const categoryPoint =
        CATEGORY_POINTS[memo.category] ?? CATEGORY_POINTS.Ideas;
      const offset = (index % 3) * 28;

      return {
        id: memo.id,
        label: memo.content.slice(0, 10),
        category: memo.category,
        x: categoryPoint.x + Math.cos(index) * offset,
        y: categoryPoint.y + Math.sin(index * 1.4) * offset,
      };
    });
  }, [memos]);

  return (
    <View style={styles.container}>
      <View style={styles.graphShell}>
        <Svg
          width={Math.min(width - 44, 420)}
          height={430}
          viewBox="0 0 360 420"
        >
          {Object.entries(CATEGORY_POINTS).map(([category, point]) => (
            <Line
              key={`center-${category}`}
              stroke="#D8D4CB"
              strokeWidth={1}
              x1={CENTER.x}
              x2={point.x}
              y1={CENTER.y}
              y2={point.y}
            />
          ))}

          {nodes.map(node => (
            <Line
              key={`line-${node.id}`}
              stroke="#E2DED5"
              strokeWidth={1}
              x1={CATEGORY_POINTS[node.category]?.x ?? CATEGORY_POINTS.Ideas.x}
              x2={node.x}
              y1={CATEGORY_POINTS[node.category]?.y ?? CATEGORY_POINTS.Ideas.y}
              y2={node.y}
            />
          ))}

          <Circle
            cx={CENTER.x}
            cy={CENTER.y}
            fill="#FFFFFF"
            r={38}
            stroke="#CBC6BA"
          />
          <SvgText
            fill="#1D1D1F"
            fontSize="13"
            fontWeight="700"
            textAnchor="middle"
            x={CENTER.x}
            y={CENTER.y + 4}
          >
            Memo
          </SvgText>

          {Object.entries(CATEGORY_POINTS).map(([category, point]) => (
            <React.Fragment key={category}>
              <Circle
                cx={point.x}
                cy={point.y}
                fill={CATEGORY_COLOR[category]}
                r={24}
              />
              <SvgText
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                x={point.x}
                y={point.y + 4}
              >
                {category}
              </SvgText>
            </React.Fragment>
          ))}

          {nodes.map(node => (
            <React.Fragment key={node.id}>
              <Circle
                cx={node.x}
                cy={node.y}
                fill="#FFFFFF"
                r={17}
                stroke={CATEGORY_COLOR[node.category] ?? CATEGORY_COLOR.Ideas}
                strokeWidth={2}
              />
              <SvgText
                fill="#4C4C51"
                fontSize="8"
                textAnchor="middle"
                x={node.x}
                y={node.y + 30}
              >
                {node.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </View>

      <View style={styles.legend}>
        {Object.keys(CATEGORY_POINTS).map(category => (
          <View key={category} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: CATEGORY_COLOR[category] },
              ]}
            />
            <Text style={styles.legendText}>{category}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAF8',
    flex: 1,
  },
  graphShell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    marginHorizontal: 9,
    marginTop: 8,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  legendText: {
    color: '#5E5E63',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MemoNetworkGraph;
