import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  setYear,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from 'date-fns';

import { CalendarBrick, Memo, useMemoStore } from '../../store/useMemoStore';
import {
  getDateForWeekDay,
  getWeekOfMonth,
  normalizeTime,
} from '../../lib/calendarUtils';
import { formatTimeIfPresent } from '../../lib/dateParser';
import { CalendarDisplayBrick, DropPreview } from './components/DraggableBrick';
import CalendarBrickEditor from './components/CalendarBrickEditor';
import DayScheduleModal, {
  DayScheduleItem,
} from './components/DayScheduleModal';
import MonthGrid from './components/MonthGrid';
import WeekBoard from './components/WeekBoard';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MOBILE_SLOT_TIMES = ['04:00', '08:00', '12:00', '16:00', '20:00'];

type CalendarMode = 'month' | 'week';

interface MemoBrickOverride {
  order?: number;
}

const CATEGORY_TONE: Record<string, 'ink' | 'clay' | 'olive' | 'steel'> = {
  Todo: 'clay',
  Work: 'ink',
  Life: 'olive',
  Ideas: 'steel',
  Misc: 'steel',
};

const applyTimeToTimestamp = (timestamp: number, time: string | null) => {
  const date = new Date(timestamp);

  if (time) {
    const [hour, minute] = time.split(':').map(Number);
    date.setHours(hour, minute, 0, 0);
  }

  return date.getTime();
};

const getMobileSlotTime = (slotIndex: number, currentTime?: string | null) => {
  if (!currentTime) {
    return currentTime ?? null;
  }

  return (
    MOBILE_SLOT_TIMES[
      Math.min(Math.max(slotIndex, 0), MOBILE_SLOT_TIMES.length - 1)
    ] ?? currentTime
  );
};

const getMobileSlotIndex = (brick: CalendarDisplayBrick) => {
  if (!brick.time) {
    return Math.min(Math.max(brick.order, 0), MOBILE_SLOT_TIMES.length - 1);
  }

  const hour = Number(brick.time.slice(0, 2));

  if (Number.isNaN(hour)) {
    return Math.min(Math.max(brick.order, 0), MOBILE_SLOT_TIMES.length - 1);
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

const getRenderedMobileSlots = (bricks: CalendarDisplayBrick[]) => {
  const slots = MOBILE_SLOT_TIMES.map(
    () => null as CalendarDisplayBrick | null,
  );

  bricks
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
    })
    .forEach(brick => {
      const preferredSlot = getMobileSlotIndex(brick);
      const slotIndex = findNearestEmptySlot(slots, preferredSlot);

      slots[slotIndex] = brick;
    });

  return slots;
};

const getDateKey = (timestamp: number) =>
  format(new Date(timestamp), 'yyyy-MM-dd');

const getMemoTitle = (content: string) => {
  return (
    content
      .split('\n')
      .find(line => line.trim())
      ?.trim() ?? '메모 일정'
  );
};

const sortScheduleItems = (a: DayScheduleItem, b: DayScheduleItem) => {
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

const getDayScheduleItems = (
  date: Date | null,
  memos: Memo[],
  calendarBricks: CalendarBrick[],
) => {
  if (!date) {
    return [];
  }

  const selectedKey = format(date, 'yyyy-MM-dd');
  const memoItems: DayScheduleItem[] = memos
    .filter(
      memo => memo.scheduledAt && getDateKey(memo.scheduledAt) === selectedKey,
    )
    .map(memo => ({
      id: `memo-${memo.id}`,
      kind: 'memo',
      note: memo.content,
      time: formatTimeIfPresent(new Date(memo.scheduledAt ?? 0)),
      title: getMemoTitle(memo.content),
      tone: 'olive',
    }));
  const brickItems: DayScheduleItem[] = calendarBricks
    .filter(
      brick =>
        !brick.deletedAt &&
        brick.scheduledAt && getDateKey(brick.scheduledAt) === selectedKey,
    )
    .map(brick => ({
      id: brick.id,
      kind: 'brick',
      note: brick.note,
      time: brick.time ?? formatTimeIfPresent(new Date(brick.scheduledAt ?? 0)),
      title: brick.title,
      tone: brick.tone,
    }));

  return [...memoItems, ...brickItems].sort(sortScheduleItems);
};

const CalendarScreen = () => {
  const { width } = useWindowDimensions();
  const isPhone = width < 760;
  const boardWidth = isPhone ? width - 20 : Math.max(width, 760);
  const columnWidth = boardWidth / 7;
  const memos = useMemoStore(state => state.memos);
  const calendarBricks = useMemoStore(state => state.calendarBricks);
  const addCalendarBrick = useMemoStore(state => state.addCalendarBrick);
  const updateMemoScheduledAt = useMemoStore(
    state => state.updateMemoScheduledAt,
  );
  const updateMemo = useMemoStore(state => state.updateMemo);
  const updateCalendarBrick = useMemoStore(state => state.updateCalendarBrick);
  const deleteCalendarBrick = useMemoStore(state => state.deleteCalendarBrick);
  const [mode, setMode] = useState<CalendarMode>('month');
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [visibleWeekStart, setVisibleWeekStart] = useState(
    startOfWeek(startOfToday(), { weekStartsOn: 0 }),
  );
  const [isYearPickerVisible, setYearPickerVisible] = useState(false);
  const [isDraggingBrick, setDraggingBrick] = useState(false);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [memoBrickOverrides, setMemoBrickOverrides] = useState<
    Record<string, MemoBrickOverride>
  >({});
  const [editingBrickId, setEditingBrickId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [isAddBrickVisible, setAddBrickVisible] = useState(false);
  const [addBrickDay, setAddBrickDay] = useState(startOfToday().getDay());
  const [addBrickTitle, setAddBrickTitle] = useState('');
  const [addBrickNote, setAddBrickNote] = useState('');
  const [addBrickHour, setAddBrickHour] = useState('');
  const [addBrickMinute, setAddBrickMinute] = useState('');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(null);

  const weekLabel = `${format(visibleWeekStart, 'M월')} ${getWeekOfMonth(
    visibleWeekStart,
  )}주차`;
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_item, index) =>
      addDays(visibleWeekStart, index),
    );
  }, [visibleWeekStart]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [visibleMonth]);

  const selectableYears = useMemo(() => {
    const baseYear = getYear(visibleMonth);

    return Array.from({ length: 12 }, (_item, index) => baseYear - 5 + index);
  }, [visibleMonth]);

  const memoBricks = useMemo<CalendarDisplayBrick[]>(() => {
    const visibleWeekEnd = addDays(visibleWeekStart, 7);

    return memos
      .filter(
        memo =>
          memo.scheduledAt &&
          memo.scheduledAt >= visibleWeekStart.getTime() &&
          memo.scheduledAt < visibleWeekEnd.getTime(),
      )
      .map((memo, index) => {
        const scheduledDate = new Date(memo.scheduledAt ?? Date.now());
        const firstLine =
          memo.content
            .split('\n')
            .find(line => line.trim())
            ?.trim() ?? '메모 일정';
        const time = formatTimeIfPresent(scheduledDate);

        return {
          id: `memo-${memo.id}`,
          day: scheduledDate.getDay(),
          note: memo.content,
          order: memoBrickOverrides[memo.id]?.order ?? 100 + index,
          title: firstLine,
          tone: CATEGORY_TONE[memo.category] ?? 'steel',
          time,
        };
      });
  }, [memoBrickOverrides, memos, visibleWeekStart]);

  const visibleBricks = useMemo(() => {
    const visibleWeekEnd = addDays(visibleWeekStart, 7);
    const currentWeekStart = startOfWeek(startOfToday(), { weekStartsOn: 0 });
    const isCurrentWeek =
      visibleWeekStart.getTime() === currentWeekStart.getTime();
    const visibleCalendarBricks = calendarBricks.filter(brick => {
      if (brick.deletedAt) {
        return false;
      }

      if (!brick.scheduledAt) {
        return isCurrentWeek;
      }

      return (
        brick.scheduledAt >= visibleWeekStart.getTime() &&
        brick.scheduledAt < visibleWeekEnd.getTime()
      );
    });

    return [...visibleCalendarBricks, ...memoBricks];
  }, [calendarBricks, memoBricks, visibleWeekStart]);

  const editingBrick = useMemo(() => {
    return visibleBricks.find(brick => brick.id === editingBrickId) ?? null;
  }, [editingBrickId, visibleBricks]);

  const selectedDayItems = useMemo(
    () => getDayScheduleItems(selectedMonthDate, memos, calendarBricks),
    [calendarBricks, memos, selectedMonthDate],
  );

  const handleOpenBrick = useCallback((brick: CalendarDisplayBrick) => {
    setEditingBrickId(brick.id);
    setDraftNote(brick.note);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditingBrickId(null);
    setDraftNote('');
  }, []);

  const handleSaveNestedMemo = useCallback(() => {
    if (editingBrickId?.startsWith('memo-')) {
      updateMemo(editingBrickId.replace('memo-', ''), draftNote);
    } else if (editingBrickId) {
      updateCalendarBrick(editingBrickId, { note: draftNote });
    }
    handleCloseEditor();
  }, [
    draftNote,
    editingBrickId,
    handleCloseEditor,
    updateCalendarBrick,
    updateMemo,
  ]);

  const monthResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 24 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx > 48) {
            setVisibleMonth(previous => addMonths(previous, -1));
          }

          if (gestureState.dx < -48) {
            setVisibleMonth(previous => addMonths(previous, 1));
          }
        },
      }),
    [],
  );

  const handleMoveBrick = useCallback(
    (id: string, nextDay: number, requestedOrder: number) => {
      const moving = visibleBricks.find(brick => brick.id === id);

      if (!moving) {
        return;
      }

      const targetOrder = isPhone
        ? Math.min(Math.max(requestedOrder, 0), MOBILE_SLOT_TIMES.length - 1)
        : requestedOrder;
      const sourceDay = moving.day;
      const sourceOrder = isPhone ? getMobileSlotIndex(moving) : moving.order;
      const targetBrick = isPhone
        ? getRenderedMobileSlots(
            visibleBricks.filter(
              brick => brick.id !== id && brick.day === nextDay,
            ),
          )[targetOrder]
        : null;

      const moveSingleBrick = (
        brick: CalendarDisplayBrick,
        day: number,
        order: number,
      ) => {
        const nextTime = isPhone
          ? getMobileSlotTime(order, brick.time)
          : brick.time ?? null;

        if (brick.id.startsWith('memo-')) {
          const memoId = brick.id.replace('memo-', '');
          setMemoBrickOverrides(previous => ({
            ...previous,
            [memoId]: {
              ...previous[memoId],
              order,
            },
          }));
          updateMemoScheduledAt(
            memoId,
            applyTimeToTimestamp(
              getDateForWeekDay(visibleWeekStart, day),
              nextTime,
            ),
          );
          return;
        }

        updateCalendarBrick(brick.id, {
          day,
          order,
          scheduledAt: applyTimeToTimestamp(
            getDateForWeekDay(visibleWeekStart, day),
            nextTime,
          ),
          time: nextTime,
        });
      };

      moveSingleBrick(moving, nextDay, targetOrder);

      if (targetBrick) {
        moveSingleBrick(targetBrick, sourceDay, sourceOrder);
      }
    },
    [
      updateCalendarBrick,
      updateMemoScheduledAt,
      isPhone,
      visibleBricks,
      visibleWeekStart,
    ],
  );

  const handleDeleteBrick = useCallback(
    (brick: CalendarDisplayBrick) => {
      const title = brick.title.slice(0, 20);
      Alert.alert('블럭 삭제', `"${title}" 블럭을 삭제하시겠습니까?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            if (brick.id.startsWith('memo-')) {
              updateMemoScheduledAt(brick.id.replace('memo-', ''), 0);
            } else {
              deleteCalendarBrick(brick.id);
            }
          },
        },
      ]);
    },
    [deleteCalendarBrick, updateMemoScheduledAt],
  );

  const openAddBrick = useCallback((day: number) => {
    setAddBrickDay(day);
    setAddBrickTitle('');
    setAddBrickNote('');
    setAddBrickHour('');
    setAddBrickMinute('');
    setAddBrickVisible(true);
  }, []);

  const closeAddBrick = useCallback(() => {
    setAddBrickVisible(false);
    setAddBrickTitle('');
    setAddBrickNote('');
    setAddBrickHour('');
    setAddBrickMinute('');
  }, []);

  const handleAddBrick = useCallback(() => {
    const time = normalizeTime(addBrickHour, addBrickMinute);
    addCalendarBrick({
      day: addBrickDay,
      note: addBrickNote.trim(),
      scheduledAt: applyTimeToTimestamp(
        getDateForWeekDay(visibleWeekStart, addBrickDay),
        time,
      ),
      time,
      title: addBrickTitle.trim() || '새 블럭',
      tone: 'steel',
    });
    closeAddBrick();
  }, [
    addBrickDay,
    addBrickHour,
    addBrickMinute,
    addBrickNote,
    addBrickTitle,
    addCalendarBrick,
    closeAddBrick,
    visibleWeekStart,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>캘린더</Text>
        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => setMode('month')}
            style={[styles.modeButton, mode === 'month' && styles.modeActive]}
          >
            <Text
              style={[
                styles.modeText,
                mode === 'month' && styles.modeTextActive,
              ]}
            >
              월별
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('week')}
            style={[styles.modeButton, mode === 'week' && styles.modeActive]}
          >
            <Text
              style={[
                styles.modeText,
                mode === 'week' && styles.modeTextActive,
              ]}
            >
              이번주 블록
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === 'month' ? (
        <MonthGrid
          calendarBricks={calendarBricks}
          days={DAYS}
          memos={memos}
          monthDays={monthDays}
          monthResponder={monthResponder}
          onOpenDay={setSelectedMonthDate}
          onOpenYearPicker={() => setYearPickerVisible(true)}
          setVisibleMonth={setVisibleMonth}
          visibleMonth={visibleMonth}
        />
      ) : (
        <WeekBoard
          boardWidth={boardWidth}
          columnWidth={columnWidth}
          days={DAYS}
          dates={weekDates}
          dropPreview={dropPreview}
          isDraggingBrick={isDraggingBrick}
          onAddBrick={openAddBrick}
          onDeleteBrick={handleDeleteBrick}
          onDragStateChange={setDraggingBrick}
          onMoveBrick={handleMoveBrick}
          onOpenBrick={handleOpenBrick}
          onPreview={setDropPreview}
          visibleBricks={visibleBricks}
          onNextWeek={() =>
            setVisibleWeekStart(previous => addDays(previous, 7))
          }
          onPreviousWeek={() =>
            setVisibleWeekStart(previous => addDays(previous, -7))
          }
          weekLabel={weekLabel}
          width={width}
        />
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => setYearPickerVisible(false)}
        transparent
        visible={isYearPickerVisible}
      >
        <View style={styles.yearBackdrop}>
          <View style={styles.yearPanel}>
            <Text style={styles.yearTitle}>년도 선택</Text>
            <View style={styles.yearGrid}>
              {selectableYears.map(year => (
                <Pressable
                  key={year}
                  onPress={() => {
                    setVisibleMonth(previous => setYear(previous, year));
                    setYearPickerVisible(false);
                  }}
                  style={[
                    styles.yearButton,
                    getYear(visibleMonth) === year && styles.yearButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.yearButtonText,
                      getYear(visibleMonth) === year &&
                        styles.yearButtonTextActive,
                    ]}
                  >
                    {year}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeAddBrick}
        transparent
        visible={isAddBrickVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.editorPanel}>
            <Text style={styles.editorTitle}>
              {DAYS[addBrickDay]}요일 블럭 추가
            </Text>
            <TextInput
              onChangeText={setAddBrickTitle}
              placeholder="블럭 제목"
              placeholderTextColor="#B5A898"
              style={styles.addBrickTitleInput}
              value={addBrickTitle}
            />
            <View style={styles.addTimeRow}>
              <Text style={styles.addTimeLabel}>시간</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={setAddBrickHour}
                placeholder="시"
                placeholderTextColor="#B5A898"
                style={styles.addTimeInput}
                value={addBrickHour}
              />
              <Text style={styles.addTimeColon}>:</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={setAddBrickMinute}
                placeholder="분"
                placeholderTextColor="#B5A898"
                style={styles.addTimeInput}
                value={addBrickMinute}
              />
            </View>
            <TextInput
              multiline
              onChangeText={setAddBrickNote}
              placeholder="작은 메모"
              placeholderTextColor="#B5A898"
              style={styles.nestedMemoInput}
              textAlignVertical="top"
              value={addBrickNote}
            />
            <View style={styles.editorActions}>
              <Pressable onPress={closeAddBrick} style={styles.textAction}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleAddBrick}
                style={styles.saveNestedButton}
              >
                <Text style={styles.saveNestedText}>추가</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CalendarBrickEditor
        brick={editingBrick}
        draftNote={draftNote}
        onChangeNote={setDraftNote}
        onClose={handleCloseEditor}
        onSave={handleSaveNestedMemo}
      />

      <DayScheduleModal
        date={selectedMonthDate}
        items={selectedDayItems}
        onClose={() => setSelectedMonthDate(null)}
        visible={selectedMonthDate !== null}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF6F0',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  title: {
    color: '#2C2520',
    fontSize: 31,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9C8E7C',
    fontSize: 13,
    marginTop: 4,
  },
  modeSwitch: {
    backgroundColor: '#EDE6D8',
    borderRadius: 6,
    flexDirection: 'row',
    padding: 3,
  },
  modeButton: {
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeActive: {
    backgroundColor: '#FAF6F0',
  },
  modeText: {
    color: '#9C8E7C',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#2C2520',
  },
  monthPanel: {
    flex: 1,
    paddingHorizontal: 22,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthNavButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  monthNavText: {
    color: '#5C4D3C',
    fontSize: 30,
    fontWeight: '300',
  },
  monthTitle: {
    color: '#2C2520',
    fontSize: 20,
    fontWeight: '800',
  },
  monthWeekHeader: {
    flexDirection: 'row',
  },
  monthWeekLabel: {
    color: '#9C8E7C',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    paddingBottom: 8,
    textAlign: 'center',
  },
  monthGrid: {
    borderLeftColor: '#E5DDD0',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5DDD0',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5DDD0',
    borderRightWidth: StyleSheet.hairlineWidth,
    minHeight: 82,
    padding: 7,
    width: `${100 / 7}%`,
  },
  monthCellMuted: {
    opacity: 0.32,
  },
  monthDayNumber: {
    color: '#2C2520',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 5,
  },
  monthMemo: {
    backgroundColor: '#EDE6D8',
    borderRadius: 3,
    color: '#5C4D3C',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  monthMore: {
    color: '#9C8E7C',
    fontSize: 10,
    fontWeight: '800',
  },
  board: {
    alignSelf: 'stretch',
    minHeight: 620,
    paddingHorizontal: 10,
  },
  weekBoardHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  weekBoardTitle: {
    color: '#2C2520',
    fontSize: 18,
    fontWeight: '800',
  },
  addBrickButton: {
    alignItems: 'center',
    borderColor: '#E5DDD0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  weekColumns: {
    flexDirection: 'row',
  },
  column: {
    borderLeftColor: '#E5DDD0',
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
  },
  dayHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 38,
    justifyContent: 'center',
  },
  dayLabel: {
    color: '#8B7355',
    fontSize: 13,
    fontWeight: '700',
  },
  dayAddButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 24,
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
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(44, 37, 32, 0.15)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  editorPanel: {
    backgroundColor: '#FAF6F0',
    borderRadius: 7,
    padding: 18,
    width: '100%',
  },
  editorTitle: {
    color: '#2C2520',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  nestedMemoInput: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
    fontSize: 16,
    lineHeight: 23,
    minHeight: 142,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  addBrickTitleInput: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  addTimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  addTimeLabel: {
    color: '#8B7355',
    fontSize: 13,
    fontWeight: '800',
    marginRight: 8,
  },
  addTimeInput: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    width: 48,
  },
  addTimeColon: {
    color: '#8B7355',
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  editorActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  textAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cancelText: {
    color: '#9C8E7C',
    fontSize: 15,
    fontWeight: '600',
  },
  saveNestedButton: {
    backgroundColor: '#5C4D3C',
    borderRadius: 4,
    marginLeft: 10,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  saveNestedText: {
    color: '#FAF6F0',
    fontSize: 15,
    fontWeight: '700',
  },
  yearBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(44, 37, 32, 0.18)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  yearPanel: {
    backgroundColor: '#FAF6F0',
    borderRadius: 7,
    padding: 18,
    width: '100%',
  },
  yearTitle: {
    color: '#2C2520',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  yearButton: {
    alignItems: 'center',
    borderColor: '#E5DDD0',
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    marginRight: 8,
    paddingVertical: 10,
    width: 86,
  },
  yearButtonActive: {
    backgroundColor: '#5C4D3C',
    borderColor: '#5C4D3C',
  },
  yearButtonText: {
    color: '#2C2520',
    fontSize: 14,
    fontWeight: '800',
  },
  yearButtonTextActive: {
    color: '#FAF6F0',
  },
});

export default CalendarScreen;
