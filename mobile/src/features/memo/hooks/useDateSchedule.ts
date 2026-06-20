import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Keyboard } from 'react-native';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { DateMatch, parseDates } from '../../../lib/dateParser';
import { useMemoStore } from '../../../store/useMemoStore';

export interface UseDateScheduleResult {
  // Selection tracking — wire the editor's onSelectionChange / onSelectedTextChange.
  selectionStart: number;
  selectionEnd: number;
  setSelection: (start: number, end: number) => void;
  selectedText: string;
  setSelectedText: (value: string) => void;

  // Schedule modal (calendar popover).
  isDateModalVisible: boolean;
  miniCalendarDays: Date[];
  scheduleHour: string;
  scheduleMinute: string;
  visibleMonth: Date;
  setScheduleHour: (value: string) => void;
  setScheduleMinute: (value: string) => void;
  setVisibleMonth: Dispatch<SetStateAction<Date>>;
  closeDateModal: () => void;

  // Handlers.
  onScheduleSelection: () => void;
  onApplyDate: (date: Date) => void;
}

/**
 * Schedule registration for a single editor. Date DETECTION + highlighting +
 * the focused-date banner live in the WebView (editor.entry.js) where all
 * positions are ProseMirror document positions; this hook only owns the
 * schedule modal and selection-based scheduling. Token insertion is delegated
 * to the editor's `insertText` command so it lands at the real cursor.
 */
export const useDateSchedule = (): UseDateScheduleResult => {
  const addScheduleFromSelection = useMemoStore(
    state => state.addScheduleFromSelection,
  );

  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');
  const [pendingScheduleText, setPendingScheduleText] = useState('');
  const lastScheduleSelectionRef = useRef<{
    match: DateMatch | null;
    text: string;
  } | null>(null);

  // The editor reports the real selected text (ProseMirror textBetween); never
  // recompute it from `text` via string offsets (selection positions are PM
  // document positions, not markdown-string indices).
  const [selectedText, setSelectedTextState] = useState('');
  const setSelectedText = useCallback((value: string) => {
    const trimmed = value.trim();
    setSelectedTextState(trimmed);
    if (trimmed) {
      lastScheduleSelectionRef.current = {
        match: parseDates(trimmed, Date.now())[0] ?? null,
        text: trimmed,
      };
    }
  }, []);

  const miniCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [visibleMonth]);

  const setSelection = useCallback((start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  }, []);

  const insertToken = useCallback((token: string) => {
    // Insert at the editor's real cursor (ProseMirror) rather than splicing the
    // markdown string at a position that isn't in markdown coordinates.
    useMemoStore
      .getState()
      .activeMarkdownEditor?.applyCommand('insertText', { text: token });
  }, []);

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
      lastScheduleSelectionRef.current = null;
      showScheduleRegisteredAlert(trimmed);
    },
    [addScheduleFromSelection, showScheduleRegisteredAlert],
  );

  const onScheduleSelection = useCallback(() => {
    const fallback = lastScheduleSelectionRef.current;
    const scheduleText = selectedText || fallback?.text || '';
    const selectedMatch =
      parseDates(scheduleText, Date.now())[0] ?? fallback?.match;

    if (scheduleText && selectedMatch) {
      registerSelectedTextSchedule(scheduleText, selectedMatch.date.getTime());
      return;
    }

    setPendingScheduleText(scheduleText);
    Keyboard.dismiss();
    setDateModalVisible(true);
  }, [registerSelectedTextSchedule, selectedText]);

  const onApplyDate = useCallback(
    (date: Date) => {
      const h = parseInt(scheduleHour, 10);
      const m = parseInt(scheduleMinute, 10);
      const hasTime = !isNaN(h) && h >= 0 && h <= 23;
      const finalDate = new Date(date);
      if (hasTime) {
        finalDate.setHours(h, isNaN(m) ? 0 : Math.min(m, 59), 0, 0);
      }

      const fallbackText = lastScheduleSelectionRef.current?.text ?? '';
      const scheduleText = pendingScheduleText || selectedText || fallbackText;

      if (scheduleText) {
        registerSelectedTextSchedule(scheduleText, finalDate.getTime());
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

  const closeDateModal = useCallback(() => {
    setDateModalVisible(false);
  }, []);

  return {
    selectionStart,
    selectionEnd,
    setSelection,
    selectedText,
    setSelectedText,
    isDateModalVisible,
    miniCalendarDays,
    scheduleHour,
    scheduleMinute,
    visibleMonth,
    setScheduleHour,
    setScheduleMinute,
    setVisibleMonth,
    closeDateModal,
    onScheduleSelection,
    onApplyDate,
  };
};
