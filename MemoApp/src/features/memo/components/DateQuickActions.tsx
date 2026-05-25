import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

const DATE_QUICK_ACTIONS = [
  { label: '오늘', token: '오늘' },
  { label: '내일', token: '내일' },
  { label: '모레', token: '모레' },
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
      contentContainerStyle={styles.content}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {DATE_QUICK_ACTIONS.map(action => (
        <Pressable
          key={action.token}
          onPress={() => onInsertToken(action.token)}
          style={({ pressed }) => [
            styles.dateAccessoryChip,
            pressed && styles.chipPressed,
          ]}
        >
          <Text style={styles.dateAccessoryText}>{action.label}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={onOpenCalendar}
        style={({ pressed }) => [
          styles.dateAccessoryChip,
          pressed && styles.chipPressed,
        ]}
      >
        <Text style={styles.dateAccessoryText}>날짜 선택</Text>
      </Pressable>
      <Pressable
        onPress={onDismissKeyboard}
        style={({ pressed }) => [
          styles.dismissChip,
          pressed && styles.chipPressed,
        ]}
      >
        <Text style={styles.dismissText}>키보드 닫기</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: 2,
  },
  dateAccessoryChip: {
    backgroundColor: '#F0EBDF',
    borderColor: '#D8CEBC',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dateAccessoryText: {
    color: '#8B7355',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissChip: {
    backgroundColor: '#5C4D3C',
    borderRadius: 16,
    marginRight: 8,
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dismissText: {
    color: '#FAF6F0',
    fontSize: 12,
    fontWeight: '800',
  },
  chipPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});

export default DateQuickActions;
