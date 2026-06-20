import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMemoStore } from '../../../store/useMemoStore';
import { NetworkSearchResult } from '../../network/services/networkService';
import { useAmbient } from '../hooks/useAmbient';
import { useDateSchedule } from '../hooks/useDateSchedule';
import AmbientNetworkCard from './AmbientNetworkCard';
import { EditorFocusedDate } from './MemoEditor.types';
import MemoEditor from './MemoEditor';
import MiniCalendarPopover from './MiniCalendarPopover';

interface PaneMemoEditorProps {
  text: string;
  memoId: string | null;
  /** Only the focused pane surfaces the date banner + schedule modal. */
  isActive: boolean;
  onChangeText: (next: string) => void;
  onFocus: () => void;
  /** Open an ambient suggestion in a (new) pane. */
  onOpenResult: (result: NetworkSearchResult) => void;
}

/**
 * A single split-pane memo editor. Date detection / highlighting / the focused
 * date computation live in the WebView (editor.entry.js, all ProseMirror
 * positions); this component only renders the focused-date banner reported by
 * the editor, the schedule modal, and ambient suggestions — and only when the
 * pane is active so multiple panes never compete for the cursor-driven UI.
 */
const PaneMemoEditor = ({
  text,
  memoId,
  isActive,
  onChangeText,
  onFocus,
  onOpenResult,
}: PaneMemoEditorProps) => {
  const [focusedDate, setFocusedDate] = useState<EditorFocusedDate | null>(
    null,
  );

  const ds = useDateSchedule();

  const ambient = useAmbient({
    text,
    memoId,
    selectionStart: ds.selectionStart,
    selectionEnd: ds.selectionEnd,
    isActive,
    onOpenResult,
  });

  const onDismissDate = useCallback(() => {
    if (focusedDate) {
      useMemoStore
        .getState()
        .activeMarkdownEditor?.applyCommand('dismissDate', {
          key: focusedDate.key,
        });
      setFocusedDate(null);
    }
  }, [focusedDate]);

  return (
    <View style={styles.container}>
      <MemoEditor
        hideToolbar
        onAmbientIdle={ambient.onAmbientIdle}
        onChangeText={onChangeText}
        onEditorFocus={onFocus}
        onFocusedDateChange={setFocusedDate}
        onScheduleSelection={ds.onScheduleSelection}
        onSelectedTextChange={ds.setSelectedText}
        onSelectionChange={ds.setSelection}
        selectedText={ds.selectedText}
        text={text}
      />

      {isActive && focusedDate ? (
        <View pointerEvents="box-none" style={styles.dateDetectionFloating}>
          <View style={styles.dateDetectionBar}>
            <Text numberOfLines={1} style={styles.dateDetectionText}>
              {focusedDate.label}
            </Text>
            <Pressable
              accessibilityLabel="감지된 날짜 닫기"
              hitSlop={8}
              onPress={onDismissDate}
              focusable={false}
              // @ts-ignore — RNW on macOS supports this
              enableFocusRing={false}
              style={({ pressed }) => [
                styles.dateDetectionClose,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateDetectionCloseText}>×</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {isActive && ds.isDateModalVisible ? (
        <MiniCalendarPopover
          days={ds.miniCalendarDays}
          hour={ds.scheduleHour}
          minute={ds.scheduleMinute}
          onApplyDate={ds.onApplyDate}
          onClose={ds.closeDateModal}
          setHour={ds.setScheduleHour}
          setMinute={ds.setScheduleMinute}
          setVisibleMonth={ds.setVisibleMonth}
          visibleMonth={ds.visibleMonth}
        />
      ) : null}

      {isActive && ambient.isCardsVisible && ambient.queryChunk &&
      ambient.results.length > 0 ? (
        <View pointerEvents="box-none" style={styles.ambientCardLayer}>
          <View style={styles.ambientCardsRow}>
            {ambient.results.map(result => (
              <AmbientNetworkCard
                compact
                key={`${result.sourceKind}:${result.chunkId}`}
                onPress={() => ambient.onSelectResult(result)}
                queryChunk={ambient.queryChunk!}
                result={result}
              />
            ))}
          </View>
        </View>
      ) : null}

      {isActive && ambient.isPreviewVisible && ambient.selectedResult ? (
        <View pointerEvents="box-none" style={styles.ambientPreviewLayer}>
          <Pressable
            accessibilityRole="button"
            onPress={ambient.onOpenSelected}
            style={({ pressed }) => [
              styles.ambientPreviewCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.ambientPreviewHeader}>
              <Text style={styles.ambientPreviewLabel}>
                {ambient.selectedResult.sourceKind === 'memo'
                  ? '유사한 생각'
                  : ambient.selectedResult.sourceLabel ?? '저장한 링크'}
              </Text>
              <Pressable
                accessibilityLabel="유사 생각 미리보기 닫기"
                hitSlop={8}
                onPress={event => {
                  event.stopPropagation();
                  ambient.dismissPreview();
                }}
                style={styles.ambientPreviewClose}
              >
                <Text style={styles.ambientPreviewCloseText}>×</Text>
              </Pressable>
            </View>
            <Text numberOfLines={4} style={styles.ambientPreviewText}>
              {ambient.selectedResult.chunkText}
            </Text>
            <Text style={styles.ambientPreviewHint}>
              한 번 더 누르면 새 패널에서 엽니다
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateDetectionFloating: {
    alignItems: 'center',
    bottom: 16,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dateDetectionBar: {
    alignItems: 'center',
    backgroundColor: '#3D5A3D',
    borderRadius: 9,
    flexDirection: 'row',
    maxWidth: '90%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#1F2D1F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  dateDetectionText: {
    color: '#F4F8F2',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  dateDetectionClose: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    marginLeft: 8,
    width: 20,
  },
  dateDetectionCloseText: {
    color: '#D7E4D3',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  ambientCardLayer: {
    bottom: 26,
    left: 18,
    position: 'absolute',
    right: 18,
    zIndex: 60,
  },
  ambientCardsRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    maxWidth: 520,
    width: '100%',
  },
  ambientPreviewLayer: {
    bottom: 26,
    left: 18,
    position: 'absolute',
    right: 18,
    zIndex: 70,
  },
  ambientPreviewCard: {
    alignSelf: 'center',
    backgroundColor: '#FCFAF7',
    borderColor: '#E1D8CA',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 380,
    padding: 12,
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    width: '100%',
  },
  ambientPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ambientPreviewLabel: {
    color: '#8B7355',
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  ambientPreviewClose: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    marginLeft: 8,
    width: 22,
  },
  ambientPreviewCloseText: {
    color: '#786B5F',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  ambientPreviewText: {
    color: '#2C2520',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  ambientPreviewHint: {
    color: '#A09180',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
});

export default PaneMemoEditor;
