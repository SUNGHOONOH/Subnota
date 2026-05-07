import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Memo } from '../../../store/useMemoStore';
import { formatScheduleLabel, getMemoTitle } from './briefingFormat';

interface TodayContextPanelProps {
  scheduledMemos: Memo[];
}

const TodayContextPanel = ({ scheduledMemos }: TodayContextPanelProps) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>다가오는 일정</Text>
      {scheduledMemos.length > 0 ? (
        scheduledMemos.map(memo => (
          <Text key={memo.id} style={styles.scheduleLine} numberOfLines={1}>
            {formatScheduleLabel(memo.scheduledAt)} {getMemoTitle(memo)}
          </Text>
        ))
      ) : (
        <Text style={styles.emptyText}>캘린더에 연결된 메모가 없습니다.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    borderBottomColor: '#E5E0D6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#1D1D1F',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: '#8A8A8E',
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleLine: {
    color: '#3A3A3D',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 5,
  },
});

export default TodayContextPanel;
