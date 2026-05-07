import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

const DATE_QUICK_ACTIONS = [
  { label: '오늘', token: '오늘' },
  { label: '내일', token: '내일' },
  { label: '월', token: '월요일' },
  { label: '화', token: '화요일' },
  { label: '수', token: '수요일' },
  { label: '목', token: '목요일' },
  { label: '금', token: '금요일' },
  { label: '토', token: '토요일' },
  { label: '일', token: '일요일' },
];

interface DateQuickActionsProps {
  onDismissKeyboard: () => void;
  onOpenCalendar: () => void;
  onInsertToken: (token: string) => void;
}

const DateQuickActions = ({
  onDismissKeyboard,
  onOpenCalendar,
  onInsertToken,
}: DateQuickActionsProps) => {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {DATE_QUICK_ACTIONS.map(action => (
        <Pressable
          key={action.token}
          onPress={() => onInsertToken(action.token)}
          style={styles.dateAccessoryChip}
        >
          <Text style={styles.dateAccessoryText}>{action.label}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onOpenCalendar} style={styles.dateAccessoryChip}>
        <Text style={styles.dateAccessoryText}>날짜 선택</Text>
      </Pressable>
      <Pressable onPress={onDismissKeyboard} style={styles.dismissChip}>
        <Text style={styles.dismissText}>키보드 닫기</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  dateAccessoryChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dateAccessoryText: {
    color: '#4257B2',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissChip: {
    backgroundColor: '#1D1D1F',
    borderRadius: 14,
    marginRight: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default DateQuickActions;
