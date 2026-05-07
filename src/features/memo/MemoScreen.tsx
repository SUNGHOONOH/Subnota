import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Network, Plus, Trash2 } from 'lucide-react-native';

import {
  DateMatch,
  findNearestDateMatch,
  formatRelativeDisplayDate,
  parseDates,
} from '../../lib/dateParser';
import { Memo, useMemoStore } from '../../store/useMemoStore';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  isYesterday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import DateQuickActions from './components/DateQuickActions';
import MemoEditor from './components/MemoEditor';
import MemoNetworkPanel from './components/MemoNetworkPanel';
import MemoSidebar from './components/MemoSidebar';
import MiniCalendarPopover from './components/MiniCalendarPopover';

const EDITOR_LINE_HEIGHT = 25;
const EDITOR_PADDING_TOP = 18;
const TOOLTIP_HEIGHT = 34;
const TOOLTIP_GAP = 10;
const SELECTION_TOOLBAR_HEIGHT = 32;
const ACCESSORY_ID = 'memo-date-accessory';

const getCursorLine = (text: string, cursorIndex: number) => {
  return text.slice(0, cursorIndex).split('\n').length - 1;
};

const getTooltipTop = (
  text: string,
  cursorIndex: number,
  editorHeight: number,
) => {
  const activeLine = getCursorLine(text, cursorIndex);
  const activeLineTop = EDITOR_PADDING_TOP + activeLine * EDITOR_LINE_HEIGHT;
  const topCandidate = activeLineTop - TOOLTIP_HEIGHT - TOOLTIP_GAP;
  const bottomCandidate = activeLineTop + EDITOR_LINE_HEIGHT + TOOLTIP_GAP;

  if (topCandidate >= EDITOR_PADDING_TOP) {
    return topCandidate;
  }

  return Math.min(
    Math.max(bottomCandidate, EDITOR_PADDING_TOP),
    Math.max(EDITOR_PADDING_TOP, editorHeight - TOOLTIP_HEIGHT - 8),
  );
};

const formatDateMatchTooltip = (match: DateMatch, baseTimestamp: number) => {
  const hasTime =
    match.date.getHours() !== 0 ||
    match.date.getMinutes() !== 0 ||
    match.date.getSeconds() !== 0;
  const dateText = formatRelativeDisplayDate(match.date, baseTimestamp);

  return hasTime ? `${dateText} ${format(match.date, 'HH:mm')}` : dateText;
};

const splitHighlightedText = (text: string, matches: DateMatch[]) => {
  const pieces: Array<{ key: string; text: string; highlighted: boolean }> = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.index > cursor) {
      pieces.push({
        key: `plain-${index}`,
        text: text.slice(cursor, match.index),
        highlighted: false,
      });
    }

    pieces.push({
      key: `date-${index}`,
      text: text.slice(match.index, match.index + match.length),
      highlighted: true,
    });
    cursor = match.index + match.length;
  });

  if (cursor < text.length) {
    pieces.push({
      key: 'plain-tail',
      text: text.slice(cursor),
      highlighted: false,
    });
  }

  return pieces;
};

const MemoScreen = () => {
  const { width: screenWidth } = useWindowDimensions();
  const isPhone = screenWidth < 768;
  const memos = useMemoStore(state => state.memos);
  const addMemo = useMemoStore(state => state.addMemo);
  const addScheduleFromSelection = useMemoStore(
    state => state.addScheduleFromSelection,
  );
  const deleteMemo = useMemoStore(state => state.deleteMemo);
  const toggleMemoPinned = useMemoStore(state => state.toggleMemoPinned);
  const updateMemo = useMemoStore(state => state.updateMemo);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [isDraftingNewMemo, setDraftingNewMemo] = useState(false);
  const [text, setText] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [dismissedTooltipKeys, setDismissedTooltipKeys] = useState<string[]>(
    [],
  );
  const [editorHeight, setEditorHeight] = useState(320);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');
  const [isNetworkVisible, setNetworkVisible] = useState(false);
  const [pendingScheduleText, setPendingScheduleText] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    setSidebarOpen(!isPhone);
  }, [isPhone]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const sortedMemos = useMemo(() => {
    return [...memos].sort((a, b) => b.createdAt - a.createdAt);
  }, [memos]);

  const sessionSections = useMemo(() => {
    const pinned = sortedMemos.filter(memo => memo.pinned);
    const unpinned = sortedMemos.filter(memo => !memo.pinned);

    return [
      {
        title: '고정된 메모',
        data: pinned,
      },
      {
        title: '오늘',
        data: unpinned.filter(memo => isToday(new Date(memo.createdAt))),
      },
      {
        title: '어제',
        data: unpinned.filter(memo => isYesterday(new Date(memo.createdAt))),
      },
      {
        title: '이전 30일',
        data: unpinned.filter(memo => {
          const createdAt = new Date(memo.createdAt);

          return !isToday(createdAt) && !isYesterday(createdAt);
        }),
      },
    ].filter(section => section.data.length > 0);
  }, [sortedMemos]);

  const activeMemo = useMemo(() => {
    return memos.find(memo => memo.id === activeMemoId) ?? null;
  }, [activeMemoId, memos]);

  const dateParseBase = Date.now();

  const activeMatches = useMemo(
    () => parseDates(text, dateParseBase),
    [dateParseBase, text],
  );

  const highlightedPieces = useMemo(() => {
    return splitHighlightedText(text, activeMatches);
  }, [activeMatches, text]);

  const focusedMatch = useMemo(() => {
    const nearest = findNearestDateMatch(activeMatches, selectionStart);

    if (nearest && dismissedTooltipKeys.includes(nearest.text)) {
      return null;
    }

    return nearest;
  }, [activeMatches, dismissedTooltipKeys, selectionStart]);

  const tooltipTop = useMemo(() => {
    return getTooltipTop(text, selectionStart, editorHeight);
  }, [editorHeight, selectionStart, text]);
  const selectedText = useMemo(() => {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    return text.slice(start, end).trim();
  }, [selectionEnd, selectionStart, text]);
  const selectionToolbarTop = useMemo(() => {
    const activeLine = getCursorLine(
      text,
      Math.max(selectionStart, selectionEnd),
    );
    const top =
      EDITOR_PADDING_TOP + activeLine * EDITOR_LINE_HEIGHT - TOOLTIP_GAP;

    return Math.min(
      Math.max(top, EDITOR_PADDING_TOP),
      Math.max(EDITOR_PADDING_TOP, editorHeight - SELECTION_TOOLBAR_HEIGHT - 8),
    );
  }, [editorHeight, selectionEnd, selectionStart, text]);

  const miniCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [visibleMonth]);

  useEffect(() => {
    if (!activeMemo && !isDraftingNewMemo && sortedMemos[0]) {
      setActiveMemoId(sortedMemos[0].id);
      setText(sortedMemos[0].content);
    }
  }, [activeMemo, isDraftingNewMemo, sortedMemos]);

  const handleEditorLayout = useCallback((event: LayoutChangeEvent) => {
    setEditorHeight(event.nativeEvent.layout.height);
  }, []);

  const persistCurrentMemo = useCallback(() => {
    const trimmed = text.trim();

    if (!trimmed) {
      return null;
    }

    if (activeMemoId) {
      updateMemo(activeMemoId, text);
      return activeMemoId;
    }

    return addMemo(text);
  }, [activeMemoId, addMemo, text, updateMemo]);

  const handleSelectMemo = useCallback(
    (memo: Memo) => {
      persistCurrentMemo();
      setActiveMemoId(memo.id);
      setDraftingNewMemo(false);
      setText(memo.content);
      setSelectionStart(0);
      setSelectionEnd(0);
      setDismissedTooltipKeys([]);
    },
    [persistCurrentMemo],
  );

  const handleNewMemo = useCallback(() => {
    if (activeMemoId && !text.trim()) {
      deleteMemo(activeMemoId);
    } else {
      persistCurrentMemo();
    }
    setActiveMemoId(null);
    setDraftingNewMemo(true);
    setText('');
    setSelectionStart(0);
    setSelectionEnd(0);
    setDismissedTooltipKeys([]);
  }, [activeMemoId, deleteMemo, persistCurrentMemo, text]);

  const handleChangeText = useCallback(
    (nextText: string) => {
      setText(nextText);
      setDismissedTooltipKeys(previous =>
        previous.filter(token => nextText.includes(token)),
      );

      if (activeMemoId) {
        updateMemo(activeMemoId, nextText);
        return;
      }

      if (nextText.trim()) {
        const id = addMemo(nextText);
        setActiveMemoId(id);
        setDraftingNewMemo(false);
      }
    },
    [activeMemoId, addMemo, updateMemo],
  );

  const deleteActiveMemo = useCallback(() => {
    if (!activeMemoId) {
      return;
    }

    const remainingMemos = sortedMemos.filter(memo => memo.id !== activeMemoId);
    const nextMemo = remainingMemos[0] ?? null;

    deleteMemo(activeMemoId);

    if (nextMemo) {
      setActiveMemoId(nextMemo.id);
      setDraftingNewMemo(false);
      setText(nextMemo.content);
    } else {
      setActiveMemoId(null);
      setDraftingNewMemo(true);
      setText('');
    }

    setSelectionStart(0);
    setSelectionEnd(0);
    setDismissedTooltipKeys([]);
  }, [activeMemoId, deleteMemo, sortedMemos]);

  const handleDeleteMemo = useCallback(() => {
    if (!activeMemoId) {
      return;
    }

    Alert.alert('메모 삭제', '메모를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: deleteActiveMemo,
      },
    ]);
  }, [activeMemoId, deleteActiveMemo]);

  const handleCancelMatch = useCallback((match: DateMatch) => {
    setDismissedTooltipKeys(previous => [...previous, match.text]);
  }, []);

  const handleTogglePinned = useCallback(() => {
    if (activeMemoId) {
      toggleMemoPinned(activeMemoId);
    }
  }, [activeMemoId, toggleMemoPinned]);

  const insertToken = useCallback(
    (token: string) => {
      const insertIndex = Math.max(selectionStart, selectionEnd);
      const prefix = text.slice(0, insertIndex);
      const suffix = text.slice(insertIndex);
      const needsLeadingSpace = prefix.length > 0 && !/\s$/.test(prefix);
      const needsTrailingSpace = suffix.length > 0 && !/^\s/.test(suffix);
      const insertion = `${needsLeadingSpace ? ' ' : ''}${token}${
        needsTrailingSpace ? ' ' : ''
      }`;
      const nextText = `${prefix}${insertion}${suffix}`;
      const nextCursor = prefix.length + insertion.length;

      handleChangeText(nextText);
      setSelectionStart(nextCursor);
      setSelectionEnd(nextCursor);
    },
    [handleChangeText, selectionEnd, selectionStart, text],
  );

  const showScheduleRegisteredAlert = useCallback((content: string) => {
    const title = content.length > 30 ? `${content.slice(0, 30)}...` : content;

    setTimeout(() => {
      Alert.alert('일정 등록', `"${title}" 일정이 등록되었습니다.`);
    }, 250);
  }, []);

  const registerSelectedTextSchedule = useCallback(
    (content: string, scheduledAt: number) => {
      const trimmed = content.trim();

      if (!trimmed) {
        return;
      }

      Keyboard.dismiss();
      addScheduleFromSelection(trimmed, scheduledAt);
      setDateModalVisible(false);
      setScheduleHour('');
      setScheduleMinute('');
      setPendingScheduleText('');
      setSelectionEnd(selectionStart);
      showScheduleRegisteredAlert(trimmed);
    },
    [addScheduleFromSelection, selectionStart, showScheduleRegisteredAlert],
  );

  const handleScheduleSelection = useCallback(() => {
    const selectedMatch = parseDates(selectedText, Date.now())[0];

    if (selectedMatch) {
      registerSelectedTextSchedule(selectedText, selectedMatch.date.getTime());
      return;
    }

    setPendingScheduleText(selectedText);
    Keyboard.dismiss();
    setDateModalVisible(true);
  }, [registerSelectedTextSchedule, selectedText]);

  const handleApplyDate = useCallback(
    (date: Date) => {
      const h = parseInt(scheduleHour, 10);
      const m = parseInt(scheduleMinute, 10);
      const hasTime = !isNaN(h) && h >= 0 && h <= 23;
      const finalDate = new Date(date);
      if (hasTime) {
        finalDate.setHours(h, isNaN(m) ? 0 : Math.min(m, 59), 0, 0);
      }

      if (pendingScheduleText || selectedText) {
        registerSelectedTextSchedule(
          pendingScheduleText || selectedText,
          finalDate.getTime(),
        );
      } else {
        insertToken(format(finalDate, hasTime ? 'yy.MM.dd HH:mm' : 'yy.MM.dd'));
        setDateModalVisible(false);
        setScheduleHour('');
        setScheduleMinute('');
      }
    },
    [
      insertToken,
      pendingScheduleText,
      registerSelectedTextSchedule,
      scheduleHour,
      scheduleMinute,
      selectedText,
    ],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {isPhone && (
              <Pressable
                onPress={() => setSidebarOpen(prev => !prev)}
                style={styles.iconButton}
              >
                <Menu size={19} color="#1D1D1F" />
              </Pressable>
            )}
            <View>
              <Text style={styles.title}>메모</Text>
              {!isPhone && (
                <Text style={styles.subtitle}>
                  날짜를 감지한 뒤 선택해서 일정으로 등록합니다
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="네트워크 보기"
              onPress={() => setNetworkVisible(true)}
              style={styles.iconButton}
            >
              <Network size={18} color="#1D1D1F" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!activeMemoId}
              onPress={handleTogglePinned}
              style={[
                styles.pinButton,
                activeMemo?.pinned && styles.pinButtonActive,
                !activeMemoId && styles.pinButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pinButtonText,
                  activeMemo?.pinned && styles.pinButtonTextActive,
                  !activeMemoId && styles.pinButtonTextDisabled,
                ]}
              >
                {activeMemo?.pinned ? '고정됨' : '고정'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="메모 삭제"
              disabled={!activeMemoId}
              onPress={handleDeleteMemo}
              style={[
                styles.iconButton,
                !activeMemoId && styles.iconButtonDisabled,
              ]}
            >
              <Trash2 size={18} color="#1D1D1F" />
            </Pressable>
            <Pressable
              accessibilityLabel="새 메모"
              onPress={handleNewMemo}
              style={styles.iconButton}
            >
              <Plus size={19} color="#1D1D1F" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {isPhone && isSidebarOpen && (
            <Pressable
              style={styles.sidebarOverlay}
              onPress={() => setSidebarOpen(false)}
            />
          )}
          {isSidebarOpen && (
            <MemoSidebar
              activeMemoId={activeMemoId}
              isDraftingNewMemo={isDraftingNewMemo}
              isPhone={isPhone}
              memoCount={sortedMemos.length}
              onSelectMemo={handleSelectMemo}
              sections={sessionSections}
            />
          )}

          <MemoEditor
            dateParseBase={dateParseBase}
            focusedMatch={focusedMatch}
            formatTooltip={formatDateMatchTooltip}
            highlightedPieces={highlightedPieces}
            inputAccessoryViewID={
              Platform.OS === 'ios' ? ACCESSORY_ID : undefined
            }
            onCancelMatch={handleCancelMatch}
            onChangeText={handleChangeText}
            onLayout={handleEditorLayout}
            onScheduleSelection={handleScheduleSelection}
            onSelectionChange={(start, end) => {
              setSelectionStart(start);
              setSelectionEnd(end);
            }}
            selectedText={selectedText}
            selectionToolbarTop={selectionToolbarTop}
            text={text}
            tooltipTop={tooltipTop}
          />
        </View>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <DateQuickActions
              onDismissKeyboard={Keyboard.dismiss}
              onInsertToken={insertToken}
              onOpenCalendar={() => setDateModalVisible(true)}
            />
          </View>
        </InputAccessoryView>
      )}

      {isDateModalVisible && (
        <MiniCalendarPopover
          days={miniCalendarDays}
          hour={scheduleHour}
          minute={scheduleMinute}
          onApplyDate={handleApplyDate}
          onClose={() => {
            setDateModalVisible(false);
            setScheduleHour('');
            setScheduleMinute('');
          }}
          setHour={setScheduleHour}
          setMinute={setScheduleMinute}
          setVisibleMonth={setVisibleMonth}
          visibleMonth={visibleMonth}
        />
      )}

      <MemoNetworkPanel
        onClose={() => setNetworkVisible(false)}
        visible={isNetworkVisible}
      />
      {isKeyboardVisible && (
        <Pressable
          accessibilityLabel="키보드 닫기"
          onPress={Keyboard.dismiss}
          style={styles.keyboardDismissFloating}
        >
          <Text style={styles.keyboardDismissText}>키보드 닫기</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const editorTextBase = {
  fontSize: 19,
  lineHeight: EDITOR_LINE_HEIGHT,
  paddingHorizontal: 4,
  paddingTop: EDITOR_PADDING_TOP,
} as const;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#1D1D1F',
    fontSize: 31,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8A8A8E',
    fontSize: 13,
    marginTop: 3,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  pinButton: {
    borderColor: '#E4E4E7',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pinButtonActive: {
    backgroundColor: '#1D1D1F',
    borderColor: '#1D1D1F',
  },
  pinButtonDisabled: {
    opacity: 0.35,
  },
  pinButtonText: {
    color: '#1D1D1F',
    fontSize: 12,
    fontWeight: '800',
  },
  pinButtonTextActive: {
    color: '#FFFFFF',
  },
  pinButtonTextDisabled: {
    color: '#8A8A8E',
  },
  iconButton: {
    alignItems: 'center',
    borderColor: '#E4E4E7',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    marginRight: 12,
    width: 34,
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sessionRail: {
    borderRightColor: '#ECECEC',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 8,
    width: 190,
  },
  sessionRailPhone: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 0,
    elevation: 10,
    left: 0,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    top: 0,
    bottom: 0,
    width: 240,
    zIndex: 50,
  },
  sidebarOverlay: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  sessionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  sessionTitle: {
    color: '#1D1D1F',
    fontSize: 12,
    fontWeight: '800',
  },
  sessionCount: {
    color: '#9A9AA0',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionSection: {
    marginBottom: 18,
  },
  sessionSectionTitle: {
    color: '#1D1D1F',
    fontSize: 20,
    fontWeight: '800',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  memoRow: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  memoRowActive: {
    backgroundColor: '#F3F3F0',
  },
  memoRowTitle: {
    color: '#1D1D1F',
    fontSize: 13,
    fontWeight: '700',
  },
  memoRowMeta: {
    color: '#8A8A8E',
    fontSize: 11,
    marginTop: 4,
  },
  editorColumn: {
    flex: 1,
    position: 'relative',
  },
  paperBackSheet: {
    backgroundColor: '#F2E69E',
    bottom: 12,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 26,
  },
  editorShell: {
    backgroundColor: '#FFF2A8',
    borderColor: '#E1D68F',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginBottom: 18,
    marginHorizontal: 18,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
  },
  highlightText: {
    ...editorTextBase,
    color: '#1D1D1F',
  },
  highlightLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  linedPaper: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  paperLine: {
    backgroundColor: 'rgba(95, 141, 150, 0.28)',
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  highlightedDate: {
    color: '#2E7D4F',
    fontWeight: '700',
  },
  placeholder: {
    ...editorTextBase,
    color: '#B7B7BD',
    position: 'absolute',
    zIndex: 3,
  },
  editor: {
    ...editorTextBase,
    color: 'transparent',
    flex: 1,
    zIndex: 1,
  },
  selectionFloatingToolbar: {
    position: 'absolute',
    right: 10,
  },
  selectionFloatingButton: {
    alignItems: 'center',
    backgroundColor: '#1D1D1F',
    borderRadius: 5,
    height: SELECTION_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  selectionFloatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipLayer: {
    left: 4,
    maxWidth: '92%',
    position: 'absolute',
    zIndex: 30,
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: '#EAF6ED',
    borderColor: '#BBDDC5',
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: TOOLTIP_HEIGHT,
    paddingLeft: 11,
    paddingRight: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  tooltipText: {
    color: '#236B45',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 270,
  },
  tooltipClose: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 7,
    width: 26,
  },
  keyboardAccessory: {
    backgroundColor: '#F7F7F7',
    borderTopColor: '#D8D8DC',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  keyboardDismissFloating: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#1D1D1F',
    borderRadius: 16,
    bottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    zIndex: 80,
  },
  keyboardDismissText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
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
  datePopover: {
    backgroundColor: '#6AA35D',
    borderRadius: 6,
    padding: 18,
    position: 'absolute',
    right: 22,
    top: 126,
    width: 340,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
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
  networkBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  networkPanel: {
    backgroundColor: '#FAFAF8',
    borderRadius: 8,
    height: '82%',
    overflow: 'hidden',
    width: '100%',
  },
  networkHeader: {
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderBottomColor: '#E5E0D6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  networkTitle: {
    color: '#1D1D1F',
    fontSize: 22,
    fontWeight: '800',
  },
  networkSubtitle: {
    color: '#8A8A8E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
});

export default MemoScreen;
