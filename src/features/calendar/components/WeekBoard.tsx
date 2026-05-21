import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';

import { clamp } from '../../../lib/calendarUtils';
import AddBrickButton from './AddBrickButton';
import DraggableBrick, {
  CalendarDisplayBrick,
  DropPreview,
} from './DraggableBrick';

const TIME_SLOTS = [4, 8, 12, 16, 20];

const getSlotIndex = (brick: CalendarDisplayBrick) => {
  if (!brick.time) {
    return clamp(brick.order, 0, TIME_SLOTS.length - 1);
  }

  const hour = Number(brick.time.slice(0, 2));
  if (Number.isNaN(hour)) {
    return clamp(brick.order, 0, TIME_SLOTS.length - 1);
  }

  if (hour < 8) {
    return 0;
  }
  if (hour < 12) {
    return 1;
  }
  if (hour < 16) {
    return 2;
  }
  if (hour < 20) {
    return 3;
  }
  return 4;
};

const findNearestEmptySlot = (
  slots: Array<CalendarDisplayBrick | null>,
  preferredSlot: number,
) => {
  if (slots[preferredSlot] === null) {
    return preferredSlot;
  }

  for (let offset = 1; offset < slots.length; offset += 1) {
    const right = preferredSlot + offset;
    const left = preferredSlot - offset;

    if (right < slots.length && slots[right] === null) {
      return right;
    }

    if (left >= 0 && slots[left] === null) {
      return left;
    }
  }

  return preferredSlot;
};

interface WeekBoardProps {
  boardWidth: number;
  columnWidth: number;
  dates: Date[];
  days: string[];
  dropPreview: DropPreview | null;
  isDraggingBrick: boolean;
  onAddBrick: (day: number) => void;
  onDeleteBrick: (brick: CalendarDisplayBrick) => void;
  onDragStateChange: (isDragging: boolean) => void;
  onMoveBrick: (id: string, day: number, order: number) => void;
  onNextWeek: () => void;
  onOpenBrick: (brick: CalendarDisplayBrick) => void;
  onPreviousWeek: () => void;
  onPreview: (preview: DropPreview | null) => void;
  visibleBricks: CalendarDisplayBrick[];
  weekLabel: string;
  width: number;
}

const WeekBoard = ({
  boardWidth,
  columnWidth,
  dates,
  days,
  dropPreview,
  isDraggingBrick,
  onAddBrick,
  onDeleteBrick,
  onDragStateChange,
  onMoveBrick,
  onNextWeek,
  onOpenBrick,
  onPreview,
  onPreviousWeek,
  visibleBricks,
  weekLabel,
  width,
}: WeekBoardProps) => {
  const isPhone = width < 760;

  if (isPhone) {
    return (
      <ScrollView
        bounces={false}
        scrollEnabled={!isDraggingBrick}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mobileBoard}>
          <View style={styles.weekBoardHeader}>
            <Pressable onPress={onPreviousWeek} style={styles.weekNavButton}>
              <Text style={styles.weekNavText}>‹</Text>
            </Pressable>
            <Text style={styles.weekBoardTitle}>{weekLabel}</Text>
            <Pressable onPress={onNextWeek} style={styles.weekNavButton}>
              <Text style={styles.weekNavText}>›</Text>
            </Pressable>
          </View>
          {days.map((dayLabel, dayIndex) => {
            const dayBricks = visibleBricks
              .filter(brick => brick.day === dayIndex)
              .sort((a, b) => {
                const aTime = a.time;
                const bTime = b.time;
                if (aTime && bTime) {
                  return aTime.localeCompare(bTime);
                }
                if (aTime && !bTime) {
                  return -1;
                }
                if (!aTime && bTime) {
                  return 1;
                }
                return a.order - b.order;
              });
            const slots = TIME_SLOTS.map(
              () => null as CalendarDisplayBrick | null,
            );

            dayBricks.forEach(brick => {
              const preferredSlot = getSlotIndex(brick);
              const slotIndex = findNearestEmptySlot(slots, preferredSlot);

              slots[slotIndex] = brick;
            });
            const isDraggingSourceDay = dayBricks.some(
              brick => brick.id === dropPreview?.id,
            );

            return (
              <View
                key={dayLabel}
                style={[
                  styles.mobileDayRow,
                  isDraggingSourceDay && styles.mobileDraggingSourceRow,
                ]}
              >
                <View style={styles.mobileDayRail}>
                  <Text style={styles.dayLabel}>{dayLabel}</Text>
                  <Text style={styles.dayDateLabel}>
                    {format(dates[dayIndex], 'M.d')}
                  </Text>
                  <AddBrickButton
                    accessibilityLabel={`${dayLabel}요일 블럭 추가`}
                    compact
                    onPress={() => onAddBrick(dayIndex)}
                  />
                </View>
                <View style={styles.mobileTimeArea}>
                  <View style={styles.timeLabelRow}>
                    {TIME_SLOTS.map(hour => (
                      <Text key={hour} style={styles.timeLabel}>
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.mobileSlotRow}>
                    {slots.map((brick, slotIndex) => {
                      const isPreviewSlot =
                        dropPreview?.day === dayIndex &&
                        clamp(dropPreview.order, 0, TIME_SLOTS.length - 1) ===
                          slotIndex;

                      return (
                        <Pressable
                          key={`${dayLabel}-${slotIndex}`}
                          onPress={() => {
                            if (!brick) {
                              onAddBrick(dayIndex);
                            }
                          }}
                          style={[
                            styles.mobileSlot,
                            isPreviewSlot &&
                              (brick
                                ? styles.mobileOccupiedSlotPreview
                                : styles.mobileSlotPreview),
                          ]}
                        >
                          {brick ? (
                            <DraggableBrick
                              brick={brick}
                              columnWidth={Math.max(1, (boardWidth - 86) / 5)}
                              index={slotIndex}
                              onDelete={onDeleteBrick}
                              onDragStateChange={onDragStateChange}
                              onMove={onMoveBrick}
                              onOpen={onOpenBrick}
                              onPreview={onPreview}
                              orientation="rows"
                            />
                          ) : (
                            <Text style={styles.emptyMobileText}>+</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      bounces={false}
      disableScrollViewPanResponder
      scrollEnabled={width < 760 && !isDraggingBrick}
      showsHorizontalScrollIndicator={false}
    >
      <View style={[styles.board, { width: boardWidth }]}>
        <View style={styles.weekBoardHeader}>
          <Pressable onPress={onPreviousWeek} style={styles.weekNavButton}>
            <Text style={styles.weekNavText}>‹</Text>
          </Pressable>
          <Text style={styles.weekBoardTitle}>{weekLabel}</Text>
          <Pressable onPress={onNextWeek} style={styles.weekNavButton}>
            <Text style={styles.weekNavText}>›</Text>
          </Pressable>
          <AddBrickButton
            accessibilityLabel="캘린더 블럭 추가"
            onPress={() => onAddBrick(new Date().getDay())}
          />
        </View>
        <View style={styles.weekColumns}>
          {days.map((dayLabel, dayIndex) => {
            const dayBricks = visibleBricks
              .filter(brick => brick.day === dayIndex)
              .sort((a, b) => {
                const aTime = a.time;
                const bTime = b.time;
                if (aTime && bTime) {
                  return aTime.localeCompare(bTime);
                }
                if (aTime && !bTime) {
                  return -1;
                }
                if (!aTime && bTime) {
                  return 1;
                }
                return a.order - b.order;
              });
            const previewOrder =
              dropPreview?.day === dayIndex
                ? clamp(dropPreview.order, 0, dayBricks.length)
                : null;

            return (
              <View
                key={dayLabel}
                style={[styles.column, { width: columnWidth }]}
              >
                <View style={styles.dayHeader}>
                  <View style={styles.dayTitleGroup}>
                    <Text style={styles.dayLabel}>{dayLabel}</Text>
                    <Text style={styles.dayDateLabel}>
                      {format(dates[dayIndex], 'M.d')}
                    </Text>
                  </View>
                  <AddBrickButton
                    accessibilityLabel={`${dayLabel}요일 블럭 추가`}
                    compact
                    onPress={() => onAddBrick(dayIndex)}
                  />
                </View>
                <View style={styles.stack}>
                  {dayBricks.map((brick, index) => (
                    <React.Fragment key={brick.id}>
                      {previewOrder === index &&
                        brick.id !== dropPreview?.id && (
                          <View style={styles.dropSlot} />
                        )}
                      <DraggableBrick
                        brick={brick}
                        columnWidth={columnWidth}
                        index={index}
                        onDelete={onDeleteBrick}
                        onDragStateChange={onDragStateChange}
                        onMove={onMoveBrick}
                        onOpen={onOpenBrick}
                        onPreview={onPreview}
                      />
                    </React.Fragment>
                  ))}
                  {previewOrder === dayBricks.length && (
                    <View style={styles.dropSlot} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  board: {
    alignSelf: 'stretch',
    minHeight: 620,
    paddingHorizontal: 10,
  },
  mobileBoard: {
    paddingHorizontal: 10,
    paddingBottom: 18,
  },
  weekBoardHeader: {
    alignItems: 'center',
    borderBottomColor: '#DDD8CC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  weekBoardTitle: {
    color: '#1D1D1F',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  weekNavButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  weekNavText: {
    color: '#1D1D1F',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 28,
  },
  weekColumns: {
    flexDirection: 'row',
  },
  column: {
    borderLeftColor: '#E6E3DA',
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
  },
  dayHeader: {
    alignItems: 'center',
    borderBottomColor: '#DDD8CC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 38,
    justifyContent: 'space-between',
    paddingLeft: 5,
  },
  dayTitleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    color: '#5E5E63',
    fontSize: 13,
    fontWeight: '700',
  },
  dayDateLabel: {
    color: 'rgba(94, 94, 99, 0.48)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  mobileDayRow: {
    borderBottomColor: '#DDD8CC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 94,
    overflow: 'visible',
    paddingVertical: 8,
    position: 'relative',
    zIndex: 1,
  },
  mobileDraggingSourceRow: {
    elevation: 200,
    zIndex: 200,
  },
  mobileDayRail: {
    alignItems: 'center',
    borderRightColor: '#DDD8CC',
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingRight: 4,
    width: 58,
  },
  mobileTimeArea: {
    flex: 1,
    minHeight: 84,
    overflow: 'visible',
    paddingLeft: 10,
    position: 'relative',
  },
  timeLabelRow: {
    flexDirection: 'row',
    height: 18,
  },
  timeLabel: {
    color: 'rgba(94, 94, 99, 0.52)',
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  mobileSlotRow: {
    flexDirection: 'row',
    minHeight: 58,
  },
  mobileSlot: {
    alignItems: 'center',
    borderColor: 'rgba(94, 94, 99, 0.2)',
    borderStyle: 'dotted',
    borderLeftWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 58,
    justifyContent: 'center',
    paddingHorizontal: 2,
    position: 'relative',
    zIndex: 1,
  },
  mobileSlotPreview: {
    backgroundColor: 'rgba(221, 243, 228, 0.62)',
    borderColor: '#7DCB94',
    borderWidth: 1,
  },
  mobileOccupiedSlotPreview: {
    backgroundColor: 'transparent',
    borderColor: '#7DCB94',
    borderWidth: 1,
  },
  emptyMobileText: {
    color: 'rgba(94, 94, 99, 0.5)',
    fontSize: 12,
    fontWeight: '700',
  },
  stack: {
    paddingTop: 14,
  },
  dropSlot: {
    backgroundColor: '#DDF3E4',
    borderColor: '#7DCB94',
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    height: 14,
    marginBottom: 7,
  },
});

export default WeekBoard;
