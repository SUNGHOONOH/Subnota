import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const DATE_QUICK_ACTIONS = [
  { label: '오늘', token: '오늘' },
  { label: '내일', token: '내일' },
  { label: '모레', token: '모레' },
];

interface DateQuickActionsProps {
  focusedDateLabel?: string | null;
  onDismissFocusedDate?: () => void;
  onDismissKeyboard: () => void;
  onOpenCalendar: () => void;
  onInsertToken: (token: string) => void;
}

const DateQuickActions = ({
  focusedDateLabel,
  onDismissFocusedDate,
  onDismissKeyboard,
  onOpenCalendar,
  onInsertToken,
}: DateQuickActionsProps) => {
  return (
    <View>
      {focusedDateLabel ? (
        <View style={styles.focusedDateBar}>
          <Text numberOfLines={1} style={styles.focusedDateLabel}>
            {focusedDateLabel}
          </Text>
          {onDismissFocusedDate ? (
            <Pressable
              accessibilityLabel="감지된 날짜 닫기"
              hitSlop={8}
              onPress={onDismissFocusedDate}
              style={({ pressed }) => [
                styles.focusedDateClose,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={styles.focusedDateCloseText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: 2,
  },
  focusedDateBar: {
    alignItems: 'center',
    backgroundColor: '#EAF6ED',
    borderColor: '#BBDDC5',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 32,
    paddingLeft: 12,
    paddingRight: 4,
  },
  focusedDateLabel: {
    color: '#236B45',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  focusedDateClose: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 8,
    width: 26,
  },
  focusedDateCloseText: {
    color: '#236B45',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
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
