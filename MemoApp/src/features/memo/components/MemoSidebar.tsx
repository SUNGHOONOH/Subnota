import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { format, isToday, isYesterday } from 'date-fns';

import { Memo } from '../../../store/useMemoStore';
import GlobalNetworkGraph from './GlobalNetworkGraph';

const MEMO_TITLE_LIMIT = 22;
const MEMO_PREVIEW_LIMIT = 38;

export type SidebarViewMode = 'chronological' | 'network';

interface MemoSection {
  data: Memo[];
  title: string;
}

interface MemoSidebarProps {
  activeCategoryFilter: string | null;
  activeMemoId: string | null;
  isDraftingNewMemo: boolean;
  isPhone: boolean;
  memoCount: number;
  onClearCategoryFilter: () => void;
  onSelectCategory: (category: string) => void;
  onSelectDraft: () => void;
  onSelectMemo: (memo: Memo) => void;
  sections: MemoSection[];
  viewMode: SidebarViewMode;
  onChangeViewMode: (mode: SidebarViewMode) => void;
}

const truncateText = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}...`;
};

const getMemoTitle = (memo: Memo) => {
  const title =
    memo.content
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '새 메모';

  return truncateText(title, MEMO_TITLE_LIMIT);
};

const getMemoPreview = (memo: Memo) => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return truncateText(lines[1] ?? lines[0] ?? '내용 없음', MEMO_PREVIEW_LIMIT);
};

const formatCreatedAt = (timestamp: number) => {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return format(date, 'a h:mm');
  }

  if (isYesterday(date)) {
    return '어제';
  }

  return format(date, 'yyyy. M. d.');
};

const CATEGORY_LABELS: Record<string, string> = {
  Work: '업무',
  Life: '일상',
  Todo: '할 일',
  Misc: '기타',
  Ideas: '아이디어',
};

const MemoSidebar = ({
  activeCategoryFilter,
  activeMemoId,
  isDraftingNewMemo,
  isPhone,
  memoCount,
  onClearCategoryFilter,
  onSelectCategory,
  onSelectDraft,
  onSelectMemo,
  sections,
  viewMode,
  onChangeViewMode,
}: MemoSidebarProps) => {
  const revealProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(revealProgress, {
      duration: 180,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [revealProgress]);

  return (
    <Animated.View
      style={[
        styles.sessionRail,
        isPhone && styles.sessionRailPhone,
        {
          opacity: revealProgress,
          transform: [
            {
              translateX: revealProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [isPhone ? -18 : -6, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Segment Control */}
      <View style={styles.segmentContainer}>
        <View style={styles.segmentControl}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'chronological' }}
            onPress={() => onChangeViewMode('chronological')}
            style={[
              styles.segmentButton,
              viewMode === 'chronological' && styles.segmentButtonActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === 'chronological' && styles.segmentTextActive,
              ]}
            >
              🕒 시간순
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'network' }}
            onPress={() => onChangeViewMode('network')}
            style={[
              styles.segmentButton,
              viewMode === 'network' && styles.segmentButtonActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === 'network' && styles.segmentTextActive,
              ]}
            >
              🕸️ 무의식 지도
            </Text>
          </Pressable>
        </View>
      </View>

      {viewMode === 'network' ? (
        <GlobalNetworkGraph
          activeMemoId={activeMemoId}
          onSelectCategory={onSelectCategory}
          onSelectMemo={onSelectMemo}
        />
      ) : (
        <>
          <View style={styles.sessionHeader}>
            <View>
              <Text style={styles.sessionTitle}>세션</Text>
              <Text style={styles.sessionSubtitle}>
                {activeCategoryFilter
                  ? CATEGORY_LABELS[activeCategoryFilter] ?? activeCategoryFilter
                  : '최근 메모'}
              </Text>
            </View>
            <View style={styles.sessionCountPill}>
              <Text style={styles.sessionCount}>{memoCount}</Text>
            </View>
          </View>

          {/* Category Filter Chip */}
          {activeCategoryFilter && (
            <View style={styles.filterChipRow}>
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>
                  필터:{' '}
                  {CATEGORY_LABELS[activeCategoryFilter] ??
                    activeCategoryFilter}
                </Text>
                <Pressable
                  accessibilityLabel="필터 해제"
                  hitSlop={6}
                  onPress={onClearCategoryFilter}
                  style={styles.filterChipClose}
                >
                  <X size={12} color="#1D1D1F" />
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.sessionScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isDraftingNewMemo && (
              <Pressable
                accessibilityRole="button"
                onPress={onSelectDraft}
                style={({ pressed }) => [
                  styles.memoRow,
                  styles.memoRowActive,
                  pressed && styles.memoRowPressed,
                ]}
              >
                <Text style={styles.memoRowTitle} numberOfLines={1}>
                  새 메모
                </Text>
                <Text style={styles.memoRowMeta} numberOfLines={1}>
                  작성 중
                </Text>
              </Pressable>
            )}
            {sections.map(section => (
              <View key={section.title} style={styles.sessionSection}>
                <Text style={styles.sessionSectionTitle}>{section.title}</Text>
                {section.data.map((memo, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={`${memo.id}-${memo.createdAt}-${index}`}
                    onPress={() => onSelectMemo(memo)}
                    style={({ pressed }) => [
                      styles.memoRow,
                      memo.id === activeMemoId && styles.memoRowActive,
                      pressed && styles.memoRowPressed,
                    ]}
                  >
                    <Text style={styles.memoRowTitle} numberOfLines={1}>
                      {getMemoTitle(memo)}
                    </Text>
                    <Text style={styles.memoRowMeta} numberOfLines={1}>
                      {`${formatCreatedAt(memo.createdAt)}  ${getMemoPreview(
                        memo,
                      )}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sessionRail: {
    backgroundColor: '#FAF6F0',
    borderRightColor: '#E5DDD0',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingRight: 10,
    width: 214,
  },
  sessionRailPhone: {
    backgroundColor: '#FAF6F0',
    borderRightWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    width: '100%',
  },
  segmentContainer: {
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 4,
  },
  segmentControl: {
    backgroundColor: '#EDE6D8',
    borderRadius: 9,
    flexDirection: 'row',
    padding: 2.5,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    paddingVertical: 7,
  },
  segmentButtonActive: {
    backgroundColor: '#FAF6F0',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  segmentText: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#2C2520',
  },
  sessionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 8,
    paddingTop: 14,
  },
  sessionTitle: {
    color: '#2C2520',
    fontSize: 22,
    fontWeight: '800',
  },
  sessionSubtitle: {
    color: '#9C8E7C',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  sessionCountPill: {
    alignItems: 'center',
    backgroundColor: '#EDE6D8',
    borderRadius: 999,
    minWidth: 26,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sessionCount: {
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '800',
  },
  filterChipRow: {
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  filterChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EDE6D8',
    borderColor: '#E5DDD0',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipText: {
    color: '#2C2520',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipClose: {
    alignItems: 'center',
    backgroundColor: '#D8CEBC',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  sessionScrollContent: {
    paddingBottom: 28,
  },
  sessionSection: {
    marginBottom: 20,
  },
  sessionSectionTitle: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    paddingBottom: 7,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  memoRow: {
    borderRadius: 10,
    marginBottom: 4,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  memoRowActive: {
    backgroundColor: '#EDE6D8',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  memoRowPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  memoRowTitle: {
    color: '#2C2520',
    fontSize: 14,
    fontWeight: '800',
  },
  memoRowMeta: {
    color: '#9C8E7C',
    fontSize: 11,
    marginTop: 4,
  },
});

export default MemoSidebar;
