import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addMonths, format, startOfToday } from 'date-fns';

interface MiniCalendarPopoverProps {
  days: Date[];
  hour: string;
  minute: string;
  onApplyDate: (date: Date) => void;
  onClose: () => void;
  setHour: (hour: string) => void;
  setMinute: (minute: string) => void;
  setVisibleMonth: React.Dispatch<React.SetStateAction<Date>>;
  visibleMonth: Date;
}

const MiniCalendarPopover = ({
  days,
  hour,
  minute,
  onApplyDate,
  onClose,
  setHour,
  setMinute,
  setVisibleMonth,
  visibleMonth,
}: MiniCalendarPopoverProps) => {
  return (
    <View style={styles.datePopover}>
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityLabel="이전 달"
          onPress={() => setVisibleMonth(previous => addMonths(previous, -1))}
          style={styles.monthButton}
        >
          <Text style={styles.monthButtonText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.monthNumber}>{format(visibleMonth, 'M')}</Text>
          <Text style={styles.monthMeta}>{format(visibleMonth, 'yyyy')}</Text>
        </View>
        <Pressable
          accessibilityLabel="다음 달"
          onPress={() => setVisibleMonth(previous => addMonths(previous, 1))}
          style={styles.monthButton}
        >
          <Text style={styles.monthButtonText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekHeader}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={styles.weekLabel}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.miniCalendar}>
        {days.map(date => {
          const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
          const isSelectedToday =
            format(date, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd');

          return (
            <Pressable
              key={date.getTime()}
              onPress={() => onApplyDate(date)}
              style={[
                styles.calendarDay,
                !isCurrentMonth && styles.calendarDayMuted,
                isSelectedToday && styles.calendarDayToday,
              ]}
            >
              <Text style={styles.calendarDayNumber}>{format(date, 'd')}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.timeInputRow}>
        <Text style={styles.timeInputLabel}>시간</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={setHour}
          placeholder="시"
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.timeInput}
          value={hour}
        />
        <Text style={styles.timeColon}>:</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={setMinute}
          placeholder="분"
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.timeInput}
          value={minute}
        />
      </View>
      <View style={styles.datePanelActions}>
        <Pressable onPress={onClose} style={styles.dateTextAction}>
          <Text style={styles.dateCancelText}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  datePopover: {
    backgroundColor: '#6AA35D',
    borderRadius: 6,
    padding: 18,
    position: 'absolute',
    right: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    top: 126,
    width: 340,
    zIndex: 40,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  monthButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },
  monthNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: 43,
  },
  miniCalendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 4,
    height: 34,
    justifyContent: 'center',
    width: 43,
  },
  calendarDayMuted: {
    opacity: 0.28,
  },
  calendarDayToday: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  calendarDayNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  timeInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  timeInputLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  timeInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    width: 48,
  },
  timeColon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  datePanelActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  dateTextAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateCancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default MiniCalendarPopover;
