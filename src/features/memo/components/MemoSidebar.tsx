import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';

import { Memo } from '../../../store/useMemoStore';

interface MemoSection {
  data: Memo[];
  title: string;
}

interface MemoSidebarProps {
  activeMemoId: string | null;
  isDraftingNewMemo: boolean;
  isPhone: boolean;
  memoCount: number;
  onSelectMemo: (memo: Memo) => void;
  sections: MemoSection[];
}

const getMemoTitle = (memo: Memo) => {
  return (
    memo.content
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '새 메모'
  );
};

const getMemoPreview = (memo: Memo) => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines[1] ?? lines[0] ?? '내용 없음';
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

const MemoSidebar = ({
  activeMemoId,
  isDraftingNewMemo,
  isPhone,
  memoCount,
  onSelectMemo,
  sections,
}: MemoSidebarProps) => {
  return (
    <View style={[styles.sessionRail, isPhone && styles.sessionRailPhone]}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>세션</Text>
        <Text style={styles.sessionCount}>{memoCount}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {isDraftingNewMemo && (
          <View style={[styles.memoRow, styles.memoRowActive]}>
            <Text style={styles.memoRowTitle} numberOfLines={1}>
              새 메모
            </Text>
            <Text style={styles.memoRowMeta} numberOfLines={1}>
              작성 중
            </Text>
          </View>
        )}
        {sections.map(section => (
          <View key={section.title} style={styles.sessionSection}>
            <Text style={styles.sessionSectionTitle}>{section.title}</Text>
            {section.data.map(memo => (
              <Pressable
                accessibilityRole="button"
                key={memo.id}
                onPress={() => onSelectMemo(memo)}
                style={[
                  styles.memoRow,
                  memo.id === activeMemoId && styles.memoRowActive,
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
    </View>
  );
};

const styles = StyleSheet.create({
  sessionRail: {
    borderRightColor: '#ECECEC',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 8,
    width: 190,
  },
  sessionRailPhone: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 0,
    bottom: 0,
    elevation: 10,
    left: 0,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    top: 0,
    width: 240,
    zIndex: 50,
  },
  sessionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  sessionTitle: {
    color: '#1D1D1F',
    fontSize: 12,
    fontWeight: '800',
  },
  sessionCount: {
    color: '#9A9AA0',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionSection: {
    marginBottom: 18,
  },
  sessionSectionTitle: {
    color: '#1D1D1F',
    fontSize: 20,
    fontWeight: '800',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  memoRow: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  memoRowActive: {
    backgroundColor: '#F3F3F0',
  },
  memoRowTitle: {
    color: '#1D1D1F',
    fontSize: 13,
    fontWeight: '700',
  },
  memoRowMeta: {
    color: '#8A8A8E',
    fontSize: 11,
    marginTop: 4,
  },
});

export default MemoSidebar;
