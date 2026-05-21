import React, { useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  TextInputContentSizeChangeEventData,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { DateMatch } from '../../../lib/dateParser';

const EDITOR_LINE_HEIGHT = 28;
const EDITOR_PADDING_TOP = 20;
const SELECTION_TOOLBAR_HEIGHT = 32;

interface MemoEditorProps {
  dateParseBase: number;
  focusedMatch: DateMatch | null;
  highlightedPieces: Array<{ highlighted: boolean; key: string; text: string }>;
  inputAccessoryViewID?: string;
  onCancelMatch: (match: DateMatch) => void;
  onChangeText: (text: string) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onScheduleSelection: () => void;
  onSelectionChange: (start: number, end: number) => void;
  selectedText: string;
  text: string;
  tooltipLeft: number;
  tooltipTop: number;
  formatTooltip: (match: DateMatch, baseTimestamp: number) => string;
}

const MemoEditor = ({
  dateParseBase,
  focusedMatch,
  formatTooltip,
  highlightedPieces,
  inputAccessoryViewID,
  onCancelMatch,
  onChangeText,
  onLayout,
  onScheduleSelection,
  onSelectionChange,
  selectedText,
  text,
  tooltipLeft,
  tooltipTop,
}: MemoEditorProps) => {
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const [editorHeight, setEditorHeight] = useState(360);
  const [contentHeight, setContentHeight] = useState(360);
  const pageHeight = Math.max(editorHeight, contentHeight);
  const paperLineCount = Math.ceil(pageHeight / EDITOR_LINE_HEIGHT) + 2;

  const handleLayout = (event: LayoutChangeEvent) => {
    setEditorHeight(event.nativeEvent.layout.height);
    onLayout(event);
  };

  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const nextHeight = Math.ceil(event.nativeEvent.contentSize.height);

    setContentHeight(previousHeight => {
      if (Math.abs(previousHeight - nextHeight) < 1) {
        return previousHeight;
      }

      return nextHeight;
    });
  };

  const handlePageTouchEnd = (locationY: number) => {
    const targetLine = Math.max(
      0,
      Math.floor((locationY - EDITOR_PADDING_TOP) / EDITOR_LINE_HEIGHT),
    );
    const currentLineCount = text.split('\n').length;

    inputRef.current?.focus();

    if (targetLine < currentLineCount) {
      return;
    }

    const nextText = `${text}${'\n'.repeat(targetLine - currentLineCount + 1)}`;
    const nextCursor = nextText.length;

    onChangeText(nextText);
    onSelectionChange(nextCursor, nextCursor);
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({
        selection: { start: nextCursor, end: nextCursor },
      });
    });
  };

  return (
    <View style={styles.editorColumn}>
      <View pointerEvents="none" style={styles.paperBackSheet} />
      <View style={styles.editorShell} onLayout={handleLayout}>
        <ScrollView
          bounces
          contentContainerStyle={[
            styles.editorScrollContent,
            { minHeight: pageHeight },
          ]}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            onTouchEnd={event =>
              handlePageTouchEnd(event.nativeEvent.locationY)
            }
            style={[styles.editorPage, { minHeight: pageHeight }]}
          >
            <View pointerEvents="none" style={styles.linedPaper}>
              {Array.from({ length: paperLineCount }, (_item, index) => (
                <View
                  key={index}
                  style={[
                    styles.paperLine,
                    {
                      top:
                        EDITOR_PADDING_TOP + (index + 1) * EDITOR_LINE_HEIGHT,
                    },
                  ]}
                />
              ))}
            </View>
            <View pointerEvents="none" style={styles.highlightLayer}>
              <Text style={[styles.highlightText, { minHeight: pageHeight }]}>
                {highlightedPieces.map(piece => (
                  <Text
                    key={piece.key}
                    style={piece.highlighted && styles.highlightedDate}
                  >
                    {piece.text}
                  </Text>
                ))}
              </Text>
            </View>
            <TextInput
              ref={inputRef}
              multiline
              autoFocus
              inputAccessoryViewID={inputAccessoryViewID}
              onChangeText={onChangeText}
              onContentSizeChange={handleContentSizeChange}
              onSelectionChange={event => {
                onSelectionChange(
                  event.nativeEvent.selection.start,
                  event.nativeEvent.selection.end,
                );
              }}
              placeholder={
                '간단하게 메모하고, 드래그하여 일정을 등록하세요! \n내일 10시 회의, 26.03.06 회고, 목요일 운동'
              }
              placeholderTextColor="#B7B7BD"
              scrollEnabled={false}
              selectionColor="#1D1D1F"
              style={[styles.editor, { minHeight: pageHeight }]}
              textAlignVertical="top"
              value={text}
            />
          </View>
        </ScrollView>

        {selectedText && (
          <View
            pointerEvents="box-none"
            style={styles.selectionFloatingToolbar}
          >
            <Pressable
              onPress={onScheduleSelection}
              style={styles.selectionFloatingButton}
            >
              <Text style={styles.selectionFloatingText}>일정 등록</Text>
            </Pressable>
          </View>
        )}

        {focusedMatch && (
          <View
            pointerEvents="box-none"
            style={[
              styles.tooltipLayer,
              { left: tooltipLeft, top: tooltipTop },
            ]}
          >
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText} numberOfLines={1}>
                {formatTooltip(focusedMatch, dateParseBase)}
              </Text>
              <Pressable
                accessibilityLabel="감지된 날짜 취소"
                hitSlop={8}
                onPress={() => onCancelMatch(focusedMatch)}
                style={styles.tooltipClose}
              >
                <X size={13} color="#1D1D1F" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const editorTextBase = {
  fontSize: 19,
  lineHeight: EDITOR_LINE_HEIGHT,
  paddingHorizontal: 4,
  paddingTop: EDITOR_PADDING_TOP,
} as const;

const styles = StyleSheet.create({
  editorColumn: {
    flex: 1,
    position: 'relative',
  },
  paperBackSheet: {
    backgroundColor: '#E5DDD0',
    borderRadius: 3,
    bottom: 12,
    opacity: 0.38,
    position: 'absolute',
    right: 10,
    top: 12,
    width: 18,
  },
  editorShell: {
    backgroundColor: '#F8F4EA',
    borderColor: '#E8E0D0',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginBottom: 20,
    marginHorizontal: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  editorScrollContent: {
    flexGrow: 1,
  },
  editorPage: {
    position: 'relative',
  },
  highlightText: {
    ...editorTextBase,
    color: '#2C2520',
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
    backgroundColor: 'rgba(143, 132, 106, 0.13)',
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  highlightedDate: {
    color: '#6B8F5B',
    fontWeight: '700',
  },
  editor: {
    ...editorTextBase,
    color: 'transparent',
    zIndex: 1,
  },
  selectionFloatingToolbar: {
    bottom: 12,
    position: 'absolute',
    right: 10,
    zIndex: 40,
  },
  selectionFloatingButton: {
    alignItems: 'center',
    backgroundColor: '#5C4D3C',
    borderRadius: 8,
    height: SELECTION_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 14,
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  selectionFloatingText: {
    color: '#FAF6F0',
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipLayer: {
    maxWidth: '92%',
    position: 'absolute',
    zIndex: 30,
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: '#F0EBDF',
    borderColor: '#D8CEBC',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 34,
    paddingLeft: 11,
    paddingRight: 5,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  tooltipText: {
    color: '#5C6B4A',
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
});

export default MemoEditor;
