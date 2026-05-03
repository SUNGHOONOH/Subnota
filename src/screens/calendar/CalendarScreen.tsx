import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  isSameDay,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';

// Android LayoutAnimation 활성화
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 32) / 7; // 좌우 패딩 16 * 2
const BLOCK_HEIGHT = 52;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

// ────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────
interface CalendarBlock {
  id: string;
  title: string;
  color: string;
  dayIndex: number; // 0(일) ~ 6(토)
  order: number; // 같은 날짜 내 순서
}

// ────────────────────────────────────────────
// 드래그 가능한 블럭 컴포넌트
// ────────────────────────────────────────────
interface DraggableBlockProps {
  block: CalendarBlock;
  onDragEnd: (blockId: string, newDayIndex: number, newOrder: number) => void;
  columnPositions: number[];
  maxOrderPerDay: Record<number, number>;
}

const DraggableBlock: React.FC<DraggableBlockProps> = ({
  block,
  onDragEnd,
  columnPositions,
  maxOrderPerDay,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(1);
  const opacity = useSharedValue(1);
  const isActive = useSharedValue(false);

  const handleDragEnd = useCallback(
    (finalX: number, finalY: number) => {
      // 가장 가까운 요일(Column) 찾기
      let closestDay = block.dayIndex;
      let minDist = Infinity;
      const blockCenterX = columnPositions[block.dayIndex] + finalX;

      columnPositions.forEach((pos, idx) => {
        const colCenter = pos + COLUMN_WIDTH / 2;
        const dist = Math.abs(blockCenterX - colCenter);
        if (dist < minDist) {
          minDist = dist;
          closestDay = idx;
        }
      });

      // 새 order 계산 (Y축 위치 기반)
      const newOrder = Math.max(
        0,
        Math.round(finalY / (BLOCK_HEIGHT + 6)),
      );

      onDragEnd(block.id, closestDay, newOrder);
    },
    [block.dayIndex, block.id, columnPositions, onDragEnd],
  );

  const gesture = Gesture.Pan()
    .onStart(() => {
      isActive.value = true;
      scale.value = withSpring(1.08, SPRING_CONFIG);
      zIndex.value = 100;
      opacity.value = withTiming(0.9, { duration: 100 });
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      isActive.value = false;
      runOnJS(handleDragEnd)(
        e.translationX + translateX.value - e.translationX,
        block.order * (BLOCK_HEIGHT + 6) + e.translationY,
      );
      // 원래 위치 복귀 (실제 위치는 state로 갱신됨)
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 1;
      opacity.value = withTiming(1, { duration: 150 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: opacity.value,
    shadowOpacity: isActive.value ? 0.25 : 0.08,
    shadowRadius: isActive.value ? 12 : 4,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          blockStyles.block,
          { backgroundColor: block.color },
          animatedStyle,
        ]}
      >
        <Text style={blockStyles.blockText} numberOfLines={2}>
          {block.title}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
};

const blockStyles = StyleSheet.create({
  block: {
    width: COLUMN_WIDTH - 6,
    minHeight: BLOCK_HEIGHT,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
  },
  blockText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: -0.2,
  },
});

// ────────────────────────────────────────────
// 칸반 캘린더 메인 화면
// ────────────────────────────────────────────
const INITIAL_BLOCKS: CalendarBlock[] = [
  { id: '1', title: '3시 회의', color: '#007AFF', dayIndex: 1, order: 0 },
  { id: '2', title: '운동', color: '#34C759', dayIndex: 2, order: 0 },
  { id: '3', title: '프로젝트\n마감', color: '#FF9500', dayIndex: 4, order: 0 },
  { id: '4', title: '점심 약속', color: '#FF2D55', dayIndex: 1, order: 1 },
  { id: '5', title: '독서', color: '#AF52DE', dayIndex: 5, order: 0 },
  { id: '6', title: '팀 미팅', color: '#5856D6', dayIndex: 3, order: 0 },
];

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const CalendarScreen = () => {
  const [blocks, setBlocks] = useState<CalendarBlock[]>(INITIAL_BLOCKS);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );

  // 요일 열의 x좌표 계산
  const columnPositions = DAY_LABELS.map(
    (_, i) => 16 + i * COLUMN_WIDTH, // 좌측 패딩 16 + 열 인덱스 * 열 너비
  );

  // 각 요일의 최대 order
  const maxOrderPerDay: Record<number, number> = {};
  blocks.forEach((b) => {
    maxOrderPerDay[b.dayIndex] = Math.max(
      maxOrderPerDay[b.dayIndex] ?? -1,
      b.order,
    );
  });

  // 블럭 드래그 완료 처리 (Auto-spacing 로직)
  const handleDragEnd = useCallback(
    (blockId: string, newDayIndex: number, newOrder: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setBlocks((prev) => {
        const moving = prev.find((b) => b.id === blockId);
        if (!moving) return prev;

        // 1. 이동 대상을 제외한 나머지 블럭
        const others = prev.filter((b) => b.id !== blockId);

        // 2. 같은 요일의 블럭들을 order 순으로 정렬
        const sameDayBlocks = others
          .filter((b) => b.dayIndex === newDayIndex)
          .sort((a, b) => a.order - b.order);

        // 3. 삽입 위치에 끼워넣기 (Auto-spacing)
        const insertAt = Math.min(newOrder, sameDayBlocks.length);
        sameDayBlocks.splice(insertAt, 0, {
          ...moving,
          dayIndex: newDayIndex,
          order: insertAt,
        });

        // 4. order 재정렬
        sameDayBlocks.forEach((b, i) => {
          b.order = i;
        });

        // 5. 다른 요일 블럭들과 합치기
        const otherDayBlocks = others.filter(
          (b) => b.dayIndex !== newDayIndex,
        );
        return [...otherDayBlocks, ...sameDayBlocks];
      });
    },
    [],
  );

  const goToPrevWeek = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  };

  const goToThisWeek = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  // 이번 주 날짜 배열
  const weekDates = DAY_LABELS.map((_, i) => addDays(currentWeekStart, i));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>📅 캘린더</Text>
          <TouchableOpacity style={styles.todayButton} onPress={goToThisWeek}>
            <Text style={styles.todayButtonText}>오늘</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={goToPrevWeek} style={styles.navButton}>
            <ChevronLeft size={20} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {format(currentWeekStart, 'yyyy년 M월', { locale: ko })}
          </Text>
          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <ChevronRight size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.dayHeaders}>
        {weekDates.map((date, i) => {
          const today = isToday(date);
          return (
            <View key={i} style={styles.dayHeaderCell}>
              <Text
                style={[
                  styles.dayLabel,
                  i === 0 && styles.sundayLabel,
                  i === 6 && styles.saturdayLabel,
                ]}
              >
                {DAY_LABELS[i]}
              </Text>
              <View style={[styles.dateCircle, today && styles.todayCircle]}>
                <Text
                  style={[styles.dateNumber, today && styles.todayNumber]}
                >
                  {format(date, 'd')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* 칸반 보드 (스크롤 가능한 세로 영역) */}
      <ScrollView
        style={styles.boardScroll}
        contentContainerStyle={styles.boardContent}
      >
        <GestureHandlerRootView style={styles.board}>
          {DAY_LABELS.map((_, dayIndex) => {
            const dayBlocks = blocks
              .filter((b) => b.dayIndex === dayIndex)
              .sort((a, b) => a.order - b.order);

            return (
              <View key={dayIndex} style={styles.column}>
                {dayBlocks.map((block) => (
                  <DraggableBlock
                    key={block.id}
                    block={block}
                    onDragEnd={handleDragEnd}
                    columnPositions={columnPositions}
                    maxOrderPerDay={maxOrderPerDay}
                  />
                ))}
                {/* 빈 공간 (드롭 영역 확보) */}
                <View style={styles.columnSpacer} />
              </View>
            );
          })}
        </GestureHandlerRootView>
      </ScrollView>

      {/* 하단 FAB */}
      <TouchableOpacity style={styles.fab}>
        <Plus size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // 헤더
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D6',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  todayButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  todayButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  navButton: {
    padding: 8,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A3C',
    marginHorizontal: 16,
  },

  // 요일 헤더
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  dayHeaderCell: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
  },
  sundayLabel: {
    color: '#FF3B30',
  },
  saturdayLabel: {
    color: '#007AFF',
  },
  dateCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCircle: {
    backgroundColor: '#007AFF',
  },
  dateNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  todayNumber: {
    color: '#fff',
    fontWeight: '800',
  },

  // 칸반 보드
  boardScroll: {
    flex: 1,
  },
  boardContent: {
    minHeight: 400,
  },
  board: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    flex: 1,
  },
  column: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 3,
    minHeight: 300,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5EA',
  },
  columnSpacer: {
    flex: 1,
    minHeight: 200,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default CalendarScreen;
