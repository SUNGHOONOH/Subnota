import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';

import { Memo, useMemoStore } from '../../../store/useMemoStore';
import GlobalNetworkGraph from './GlobalNetworkGraph';

const MEMO_TITLE_LIMIT = 22;
const MEMO_PREVIEW_LIMIT = 38;

export type SidebarViewMode = 'chronological' | 'mini' | 'network';

interface MemoSection {
  data: Memo[];
  title: string;
}

interface MemoSidebarProps {
  activeCategoryFilter: string | null;
  activeMemoId: string | null;
  isDraftingNewMemo: boolean;
  isPhone: boolean;
  onClearCategoryFilter: () => void;
  onSelectCategory: (category: string) => void;
  onSelectDraft: () => void;
  onSelectMemo: (memo: Memo) => void;
  openMemoPanelNumbers?: Record<string, number[]>;
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
      ?.trim() ?? '새 노트';

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
  MiniSubnota: 'Mini Subnota',
};

const MemoSidebar = ({
  activeCategoryFilter,
  activeMemoId,
  isDraftingNewMemo,
  isPhone,
  onClearCategoryFilter,
  onSelectCategory,
  onSelectDraft,
  onSelectMemo,
  openMemoPanelNumbers = {},
  viewMode,
  onChangeViewMode,
}: MemoSidebarProps) => {
  const memos = useMemoStore(state => state.memos);
  const sortedMemos = React.useMemo(() => {
    return [...memos]
      .filter(memo => memo.content.trim())
      .filter(memo =>
        viewMode === 'mini'
          ? memo.category === 'MiniSubnota'
          : activeCategoryFilter
            ? true
            : memo.category !== 'MiniSubnota',
      )
      .filter(memo =>
        activeCategoryFilter ? memo.category === activeCategoryFilter : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [activeCategoryFilter, memos, viewMode]);

  const sections = React.useMemo(() => {
    const pinned = sortedMemos.filter(memo => memo.pinned);
    const unpinned = sortedMemos.filter(memo => !memo.pinned);
    const recent = unpinned.slice(0, 3);
    const older = unpinned.slice(3);

    const sectionsData = [];
    if (pinned.length > 0) sectionsData.push({ title: '고정된 세션', data: pinned });
    if (recent.length > 0) sectionsData.push({ title: '최근 작업', data: recent });
    if (older.length > 0) sectionsData.push({ title: '이전 세션', data: older });

    return sectionsData;
  }, [sortedMemos]);
  const memoCount = sortedMemos.length;

  const revealProgress = useRef(new Animated.Value(0)).current;
  const isMac = Platform.OS === 'macos' && !isPhone;
  const shouldRenderNetworkInRail = viewMode === 'network' && !isMac;

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
        isMac && styles.sessionRailMac,
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
        <View
          style={[styles.segmentControl, isMac && styles.segmentControlMac]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'chronological' }}
            onPress={() => onChangeViewMode('chronological')}
            focusable={false}
            // @ts-ignore
            enableFocusRing={false}
            style={[
              styles.segmentButton,
              viewMode === 'chronological' && styles.segmentButtonActive,
              isMac &&
                viewMode === 'chronological' &&
                styles.segmentButtonActiveMac,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === 'chronological' && styles.segmentTextActive,
              ]}
            >
              {isMac ? '메모' : '시간순'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{
              selected: viewMode === (isMac ? 'mini' : 'network'),
            }}
            onPress={() => onChangeViewMode(isMac ? 'mini' : 'network')}
            focusable={false}
            // @ts-ignore
            enableFocusRing={false}
            style={[
              styles.segmentButton,
              viewMode === (isMac ? 'mini' : 'network') &&
                styles.segmentButtonActive,
              isMac && viewMode === 'mini' && styles.segmentButtonActiveMac,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === (isMac ? 'mini' : 'network') &&
                  styles.segmentTextActive,
              ]}
            >
              {isMac ? '미니' : '지도'}
            </Text>
          </Pressable>
        </View>
      </View>

      {shouldRenderNetworkInRail ? (
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
                {viewMode === 'mini'
                  ? 'Mini Subnota'
                  : activeCategoryFilter
                  ? CATEGORY_LABELS[activeCategoryFilter] ??
                    activeCategoryFilter
                  : '최근 노트'}
              </Text>
            </View>
            <View
              style={[
                styles.sessionCountPill,
                isMac && styles.sessionCountPillMac,
              ]}
            >
              <Text style={styles.sessionCount}>{memoCount}</Text>
            </View>
          </View>

          {/* Category Filter Chip */}
          {activeCategoryFilter && (
            <View style={styles.filterChipRow}>
              <View style={[styles.filterChip, isMac && styles.filterChipMac]}>
                <Text style={styles.filterChipText}>
                  필터:{' '}
                  {CATEGORY_LABELS[activeCategoryFilter] ??
                    activeCategoryFilter}
                </Text>
                <Pressable
                  accessibilityLabel="필터 해제"
                  hitSlop={6}
                  onPress={onClearCategoryFilter}
                  focusable={false}
                  // @ts-ignore
                  enableFocusRing={false}
                  style={styles.filterChipClose}
                >
                  <Text style={styles.filterChipCloseText}>x</Text>
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.sessionScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isDraftingNewMemo && (
              <Pressable
                accessibilityRole="button"
                onPress={onSelectDraft}
                focusable={false}
                // @ts-ignore
                enableFocusRing={false}
                style={({ pressed }) => [
                  styles.memoRow,
                  styles.memoRowActive,
                  isMac && styles.memoRowActiveMac,
                  pressed && styles.memoRowPressed,
                ]}
              >
                <Text style={styles.memoRowTitle} numberOfLines={1}>
                  새 노트
                </Text>
                <Text style={styles.memoRowMeta} numberOfLines={1}>
                  작성 중
                </Text>
              </Pressable>
            )}
            {sections.map(section => (
              <View key={section.title} style={styles.sessionSection}>
                <Text style={styles.sessionSectionTitle}>{section.title}</Text>
                {section.data.map((memo, index) => {
                  const panelNumbers = openMemoPanelNumbers[memo.id] ?? [];

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={`${memo.id}-${memo.createdAt}-${index}`}
                      onPress={() => onSelectMemo(memo)}
                      focusable={false}
                      // @ts-ignore
                      enableFocusRing={false}
                      style={({ pressed }) => [
                        styles.memoRow,
                        memo.id === activeMemoId && styles.memoRowActive,
                        isMac &&
                          memo.id === activeMemoId &&
                          styles.memoRowActiveMac,
                        pressed && styles.memoRowPressed,
                      ]}
                    >
                      <View style={styles.memoRowTopline}>
                        <Text style={styles.memoRowTitle} numberOfLines={1}>
                          {getMemoTitle(memo)}
                        </Text>
                        {panelNumbers.length > 0 && (
                          <View style={styles.memoOpenBadges}>
                            {panelNumbers.map(panelNumber => (
                              <View
                                key={panelNumber}
                                style={[
                                  styles.memoOpenBadge,
                                  isMac && styles.memoOpenBadgeMac,
                                ]}
                              >
                                <Text style={styles.memoOpenBadgeText}>
                                  {panelNumber}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={styles.memoRowMeta} numberOfLines={1}>
                        {`${formatCreatedAt(memo.updatedAt)}  ${getMemoPreview(
                          memo,
                        )}`}
                      </Text>
                    </Pressable>
                  );
                })}
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
    backgroundColor: '#FAF9F5', // design.md: canvas
    borderRightColor: '#EBE6DF', // design.md: hairline-soft
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingRight: 10,
    width: 214,
  },
  sessionRailMac: {
    backgroundColor: '#FAF9F5',
    borderRightColor: 'rgba(230, 223, 216, 0.5)', // design.md: hairline
    paddingLeft: 10,
    paddingRight: 10,
    width: 238,
  },
  sessionRailPhone: {
    backgroundColor: '#FAF9F5',
    borderRightWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    width: '100%',
  },
  segmentContainer: {
    paddingBottom: 6,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  segmentControl: {
    backgroundColor: '#F5F0E8', // design.md: surface-soft
    borderRadius: 7,
    flexDirection: 'row',
    padding: 2,
  },
  segmentControlMac: {
    backgroundColor: '#F5F0E8',
    borderColor: 'rgba(20, 20, 19, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 5,
    flex: 1,
    minHeight: 28,
    paddingVertical: 5,
  },
  segmentButtonActive: {
    backgroundColor: '#EFE9DE', // design.md: surface-card
    ...Platform.select({
      ios: {
        shadowColor: '#141413', // design.md: ink
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      default: {},
    }),
  },
  segmentButtonActiveMac: {
    backgroundColor: '#EFE9DE',
  },
  segmentText: {
    color: '#8E8B82', // design.md: muted-soft
    fontSize: 11,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#141413', // design.md: ink
  },
  sessionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  sessionTitle: {
    color: '#141413', // design.md: ink
    fontSize: Platform.OS === 'macos' ? 15 : 16,
    fontWeight: '800',
  },
  sessionSubtitle: {
    color: '#6C6A64', // design.md: muted
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  sessionCountPill: {
    alignItems: 'center',
    backgroundColor: '#F5F0E8', // design.md: surface-soft
    borderRadius: 999,
    minWidth: 26,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sessionCountPillMac: {
    backgroundColor: '#F5F0E8',
    borderColor: 'rgba(20, 20, 19, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sessionCount: {
    color: '#6C6A64', // design.md: muted
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
    backgroundColor: '#F5F0E8', // design.md: surface-soft
    borderColor: '#EBE6DF', // design.md: hairline-soft
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipMac: {
    backgroundColor: '#F5F0E8',
    borderColor: 'rgba(20, 20, 19, 0.05)',
  },
  filterChipText: {
    color: '#141413', // design.md: ink
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipClose: {
    alignItems: 'center',
    backgroundColor: '#C8BBA6',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  filterChipCloseText: {
    color: '#1D1D1F',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  sessionScrollContent: {
    paddingBottom: 28,
  },
  sessionSection: {
    marginBottom: 20,
  },
  sessionSectionTitle: {
    color: '#8E8B82', // design.md: muted-soft
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingBottom: 7,
    paddingHorizontal: 10,
    paddingTop: 10,
    textTransform: 'uppercase',
  },
  memoRow: {
    borderRadius: 7,
    marginBottom: 3,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  memoRowActive: {
    backgroundColor: '#EFE9DE', // design.md: surface-card
  },
  memoRowActiveMac: {
    backgroundColor: '#EFE9DE',
    borderColor: 'rgba(20, 20, 19, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  memoRowPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  memoRowTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  memoRowTitle: {
    color: '#141413', // design.md: ink
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 0,
  },
  memoRowMeta: {
    color: '#6C6A64', // design.md: muted
    fontSize: 11,
    marginTop: 4,
  },
  memoOpenBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  memoOpenBadge: {
    alignItems: 'center',
    backgroundColor: '#141413',
    borderRadius: 999,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
  memoOpenBadgeMac: {
    backgroundColor: '#2C2520',
  },
  memoOpenBadgeText: {
    color: '#FAF9F5',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});

export default MemoSidebar;
