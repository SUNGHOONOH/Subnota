import React from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { DateMatch } from '../../../lib/dateParser';

const EDITOR_LINE_HEIGHT = 25;
const EDITOR_PADDING_TOP = 18;
const SELECTION_TOOLBAR_HEIGHT = 32;

interface HighlightedPiece {
  highlighted: boolean;
  key: string;
  text: string;
}

interface MemoEditorProps {
  dateParseBase: number;
  focusedMatch: DateMatch | null;
  highlightedPieces: HighlightedPiece[];
  inputAccessoryViewID?: string;
  onCancelMatch: (match: DateMatch) => void;
  onChangeText: (text: string) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onScheduleSelection: () => void;
  onSelectionChange: (start: number, end: number) => void;
  selectedText: string;
  selectionToolbarTop: number;
  text: string;
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
  selectionToolbarTop,
  text,
  tooltipTop,
}: MemoEditorProps) => {
  return (
    <View style={styles.editorColumn}>
      <View pointerEvents="none" style={styles.paperBackSheet} />
      <View style={styles.editorShell} onLayout={onLayout}>
        <View pointerEvents="none" style={styles.linedPaper}>
          {Array.from({ length: 26 }, (_item, index) => (
            <View
              key={index}
              style={[
                styles.paperLine,
                { top: EDITOR_PADDING_TOP + (index + 1) * EDITOR_LINE_HEIGHT },
              ]}
            />
          ))}
        </View>
        <View pointerEvents="none" style={styles.highlightLayer}>
          <Text style={styles.highlightText}>
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
        {!text && (
          <Text style={styles.placeholder}>
            {
              '하얀 종이에 쓰듯이 입력하세요.\n예: 내일 10시 회의, 26.03.06 회고, 목요일 운동'
            }
          </Text>
        )}
        <TextInput
          multiline
          autoFocus
          inputAccessoryViewID={inputAccessoryViewID}
          value={text}
          onChangeText={onChangeText}
          onSelectionChange={event => {
            onSelectionChange(
              event.nativeEvent.selection.start,
              event.nativeEvent.selection.end,
            );
          }}
          selectionColor="#1D1D1F"
          style={styles.editor}
          textAlignVertical="top"
        />

        {selectedText && (
          <View
            pointerEvents="box-none"
            style={[
              styles.selectionFloatingToolbar,
              { top: selectionToolbarTop },
            ]}
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
            style={[styles.tooltipLayer, { top: tooltipTop }]}
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
    minHeight: 34,
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
});

export default MemoEditor;
