import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Memo } from '../../../store/useMemoStore';
import { formatScheduleLabel, getMemoTitle } from './briefingFormat';

interface PriorityQueueProps {
  memos: Memo[];
}

const PriorityQueue = ({ memos }: PriorityQueueProps) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>우선순위</Text>
      {memos.length > 0 ? (
        memos.map((memo, index) => (
          <View key={memo.id} style={styles.priorityRow}>
            <Text style={styles.priorityRank}>{index + 1}</Text>
            <View style={styles.priorityCopy}>
              <Text style={styles.priorityTitle} numberOfLines={1}>
                {getMemoTitle(memo)}
              </Text>
              <Text style={styles.priorityMeta}>
                {formatScheduleLabel(memo.scheduledAt)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>정리할 메모가 없습니다.</Text>
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
  priorityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  priorityRank: {
    color: '#A75C4A',
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
  priorityCopy: {
    flex: 1,
  },
  priorityTitle: {
    color: '#1D1D1F',
    fontSize: 15,
    fontWeight: '800',
  },
  priorityMeta: {
    color: '#7A7A7E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  emptyText: {
    color: '#8A8A8E',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PriorityQueue;
