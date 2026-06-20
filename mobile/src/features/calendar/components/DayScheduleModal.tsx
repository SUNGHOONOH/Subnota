import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';

import PlatformModal from '../../../components/PlatformModal';
import { BrickTone } from '../../../store/useMemoStore';

export interface DayScheduleItem {
  id: string;
  kind: 'memo' | 'brick';
  note: string;
  time: string | null;
  title: string;
  tone: BrickTone;
}

interface DayScheduleModalProps {
  date: Date | null;
  items: DayScheduleItem[];
  onClose: () => void;
  visible: boolean;
}

const toneStyles: Record<BrickTone, object> = {
  clay: { backgroundColor: '#F2E4D8' },
  ink: { backgroundColor: '#DEE5EA' },
  olive: { backgroundColor: '#E4ECDD' },
  steel: { backgroundColor: '#E8E6DD' },
};

const DayScheduleModal = ({
  date,
  items,
  onClose,
  visible,
}: DayScheduleModalProps) => {
  return (
    <PlatformModal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {date ? `${format(date, 'M월 d일')} 일정` : '일정'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.listContent,
              items.length === 0 && styles.emptyContent,
            ]}
          >
            {items.length === 0 ? (
              <Text style={styles.emptyText}>등록된 일정 없음</Text>
            ) : (
              items.map(item => (
                <View key={item.id} style={styles.item}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.timeText}>{item.time ?? '종일'}</Text>
                    <Text style={[styles.kindBadge, toneStyles[item.tone]]}>
                      {item.kind === 'memo' ? '노트' : '블럭'}
                    </Text>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.note.trim().length > 0 && (
                    <Text style={styles.itemNote} numberOfLines={4}>
                      {item.note}
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </PlatformModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  panel: {
    backgroundColor: '#FAFAF8',
    borderRadius: 8,
    maxHeight: '72%',
    padding: 18,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: '#1D1D1F',
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  closeText: {
    color: '#6E6E73',
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    gap: 8,
    paddingBottom: 2,
  },
  emptyContent: {
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#8A8A8E',
    fontSize: 14,
    fontWeight: '700',
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1DED5',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  itemTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  timeText: {
    color: '#1D1D1F',
    fontSize: 12,
    fontWeight: '900',
  },
  kindBadge: {
    borderRadius: 4,
    color: '#3A3A3C',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  itemTitle: {
    color: '#1D1D1F',
    fontSize: 14,
    fontWeight: '600',
  },
  itemNote: {
    color: '#6E6E73',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
});

export default DayScheduleModal;
