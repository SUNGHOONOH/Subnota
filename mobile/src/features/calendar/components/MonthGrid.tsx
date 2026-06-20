import React, { useMemo } from 'react';
import {
  PanResponderInstance,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { addMonths, format } from 'date-fns';

import { CalendarBrick, Memo } from '../../../store/useMemoStore';
import { formatTimeIfPresent } from '../../../lib/dateParser';

interface MonthGridProps {
  calendarBricks: CalendarBrick[];
  days: string[];
  isCompact: boolean;
  memos: Memo[];
  monthDays: Date[];
  monthResponder: PanResponderInstance;
  onOpenDay: (date: Date) => void;
  onOpenYearPicker: () => void;
  setVisibleMonth: React.Dispatch<React.SetStateAction<Date>>;
  visibleMonth: Date;
}

interface MonthSchedulePreview {
  id: string;
  kind: 'memo' | 'brick';
  time: string | null;
  title: string;
  tone: CalendarBrick['tone'];
}

const getDateKey = (timestamp: number) =>
  format(new Date(timestamp), 'yyyy-MM-dd');

const getMemoTitle = (content: string) => {
  return (
    content
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '기록 일정'
  );
};

const compareSchedulePreview = (
  a: MonthSchedulePreview,
  b: MonthSchedulePreview,
) => {
  if (a.time && b.time) {
    return a.time.localeCompare(b.time);
  }

  if (a.time) {
    return -1;
  }

  if (b.time) {
    return 1;
  }

  return a.title.localeCompare(b.title);
};

const MonthGrid = ({
  calendarBricks,
  days,
  isCompact,
  memos,
  monthDays,
  monthResponder,
  onOpenDay,
  onOpenYearPicker,
  setVisibleMonth,
  visibleMonth,
}: MonthGridProps) => {
  const { height } = useWindowDimensions();
  const schedulesByDate = useMemo(() => {
    const grouped: Record<string, MonthSchedulePreview[]> = {};

    memos.forEach(memo => {
      if (!memo.scheduledAt) {
        return;
      }

      const key = getDateKey(memo.scheduledAt);
      grouped[key] = [
        ...(grouped[key] ?? []),
        {
          id: `memo-${memo.id}`,
          kind: 'memo',
          time: formatTimeIfPresent(new Date(memo.scheduledAt)),
          title: getMemoTitle(memo.content),
          tone: 'olive',
        },
      ];
    });

    calendarBricks.forEach(brick => {
      if (brick.deletedAt || !brick.scheduledAt) {
        return;
      }

      const key = getDateKey(brick.scheduledAt);
      grouped[key] = [
        ...(grouped[key] ?? []),
        {
          id: brick.id,
          kind: 'brick',
          time: brick.time ?? formatTimeIfPresent(new Date(brick.scheduledAt)),
          title: brick.title,
          tone: brick.tone,
        },
      ];
    });

    Object.values(grouped).forEach(items => items.sort(compareSchedulePreview));

    return grouped;
  }, [calendarBricks, memos]);
  const rowCount = Math.max(1, Math.ceil(monthDays.length / 7));
  const availableGridHeight = Math.max(280, height - 214);
  const compactCellHeight = Math.max(
    48,
    Math.min(72, Math.floor(availableGridHeight / rowCount)),
  );
  const schedulePreviewLimit = isCompact ? 1 : 3;

  return (
    <View
      style={[styles.monthPanel, isCompact && styles.monthPanelCompact]}
      {...monthResponder.panHandlers}
    >
      <View style={[styles.monthHeader, isCompact && styles.monthHeaderCompact]}>
        <Pressable
          onPress={() => setVisibleMonth(previous => addMonths(previous, -1))}
          style={styles.monthNavButton}
        >
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>
        <Pressable onPress={onOpenYearPicker}>
          <Text style={styles.monthTitle}>
            {format(visibleMonth, 'yyyy년 M월')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setVisibleMonth(previous => addMonths(previous, 1))}
          style={styles.monthNavButton}
        >
          <Text style={styles.monthNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.monthWeekHeader}>
        {days.map(day => (
          <Text key={day} style={styles.monthWeekLabel}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {monthDays.map(date => {
          const key = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
          const daySchedules = schedulesByDate[key] ?? [];

          return (
            <Pressable
              key={key}
              onPress={() => onOpenDay(date)}
              style={[
                styles.monthCell,
                isCompact && styles.monthCellCompact,
                isCompact && { minHeight: compactCellHeight },
                !isCurrentMonth && styles.monthCellMuted,
              ]}
            >
              <Text
                style={[
                  styles.monthDayNumber,
                  isCompact && styles.monthDayNumberCompact,
                ]}
              >
                {format(date, 'd')}
              </Text>
              {daySchedules.slice(0, schedulePreviewLimit).map(item => (
                <Text
                  key={item.id}
                  numberOfLines={1}
                  style={[
                    styles.monthSchedule,
                    styles[`monthSchedule_${item.tone}`],
                    item.kind === 'memo' && styles.monthScheduleMemo,
                  ]}
                >
                  {item.time ? `${item.time} ` : ''}
                  {item.title}
                </Text>
              ))}
              {daySchedules.length > schedulePreviewLimit && (
                <Text style={styles.monthMore}>
                  +{daySchedules.length - schedulePreviewLimit}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  monthPanel: {
    flex: 1,
    paddingHorizontal: 22,
  },
  monthPanelCompact: {
    paddingHorizontal: 14,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthHeaderCompact: {
    marginBottom: 6,
  },
  monthNavButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  monthNavText: {
    color: '#1D1D1F',
    fontSize: 30,
    fontWeight: '300',
  },
  monthTitle: {
    color: '#1D1D1F',
    fontSize: 20,
    fontWeight: '800',
  },
  monthWeekHeader: {
    flexDirection: 'row',
  },
  monthWeekLabel: {
    color: '#7A7A7E',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    paddingBottom: 8,
    textAlign: 'center',
  },
  monthGrid: {
    borderLeftColor: '#E1DED5',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E1DED5',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    borderBottomColor: '#E1DED5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E1DED5',
    borderRightWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
    padding: 5,
    width: `${100 / 7}%`,
  },
  monthCellCompact: {
    padding: 4,
  },
  monthCellMuted: {
    opacity: 0.32,
  },
  monthDayNumber: {
    color: '#1D1D1F',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  monthDayNumberCompact: {
    fontSize: 12,
    marginBottom: 2,
  },
  monthSchedule: {
    borderRadius: 3,
    color: '#2F3437',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
    marginBottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  monthSchedule_clay: {
    backgroundColor: '#F2E4D8',
  },
  monthSchedule_ink: {
    backgroundColor: '#DEE5EA',
  },
  monthSchedule_olive: {
    backgroundColor: '#E4ECDD',
  },
  monthSchedule_steel: {
    backgroundColor: '#E8E6DD',
  },
  monthScheduleMemo: {
    borderLeftColor: '#7C9A72',
    borderLeftWidth: 2,
  },
  monthMore: {
    color: '#6E6E73',
    fontSize: 10,
    fontWeight: '800',
  },
});

export default MonthGrid;
