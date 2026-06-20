import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface PriorityItem {
  id: string;
  meta: string;
  title: string;
}

interface PriorityQueueProps {
  items: PriorityItem[];
}

const PriorityQueue = ({ items }: PriorityQueueProps) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>우선순위</Text>
      {items.length > 0 ? (
        items.map((item, index) => (
          <View key={item.id} style={styles.priorityRow}>
            <Text style={styles.priorityRank}>{index + 1}</Text>
            <View style={styles.priorityCopy}>
              <Text style={styles.priorityTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.priorityMeta}>{item.meta}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>
          캘린더 일정이나 추천 후보가 없습니다.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#2C2520',
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
    color: '#8B7355',
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
  priorityCopy: {
    flex: 1,
  },
  priorityTitle: {
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '800',
  },
  priorityMeta: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  emptyText: {
    color: '#9C8E7C',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PriorityQueue;
