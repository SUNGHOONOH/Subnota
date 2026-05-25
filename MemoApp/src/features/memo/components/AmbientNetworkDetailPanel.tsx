import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { MemoChunk } from '../../../lib/memoChunker';
import { NetworkSearchResult } from '../../../services/backend/networkService';

interface AmbientNetworkDetailPanelProps {
  onClose: () => void;
  onNavigateToMemo: (memoId: string) => void;
  queryChunk: MemoChunk | null;
  result: NetworkSearchResult | null;
  visible: boolean;
}

const formatRelativeMemoTime = (timestamp: number | null) => {
  if (!timestamp) {
    return '이전 메모';
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)),
  );

  if (days === 0) {
    return '오늘';
  }

  if (days < 30) {
    return `${days}일 전`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}개월 전`;
  }

  return `${Math.floor(months / 12)}년 전`;
};

const splitHighlight = (text: string, start: number, end: number) => {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));

  return {
    after: text.slice(safeEnd),
    before: text.slice(0, safeStart),
    highlighted: text.slice(safeStart, safeEnd),
  };
};

const AmbientNetworkDetailPanel = ({
  onClose,
  onNavigateToMemo,
  queryChunk,
  result,
  visible,
}: AmbientNetworkDetailPanelProps) => {
  const highlightedMemo = result
    ? splitHighlight(result.memoContent, result.startIndex, result.endIndex)
    : null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>비슷한 기억</Text>
              <Text style={styles.subtitle}>원문은 이 창에서만 강조됩니다</Text>
            </View>
            <Pressable
              accessibilityLabel="비슷한 기억 닫기"
              hitSlop={8}
              onPress={onClose}
              style={styles.iconButton}
            >
              <X size={18} color="#5C4D3C" />
            </Pressable>
          </View>

          {!queryChunk || !result || !highlightedMemo ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>표시할 연결 문장이 없습니다.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator
              >
                <View style={styles.compareSection}>
                  <Text style={styles.sectionLabel}>지금 쓰는 문장</Text>
                  <Text style={styles.queryText}>{queryChunk.text}</Text>
                </View>

                <View style={styles.compareSection}>
                  <Text style={styles.sectionLabel}>
                    {`${formatRelativeMemoTime(
                      result.memoCreatedAt,
                    )} · 유사도 ${Math.round(result.similarity * 100)}%`}
                  </Text>
                  <Text style={styles.resultText}>{result.chunkText}</Text>
                </View>

                <View style={styles.memoSection}>
                  <Text style={styles.sectionLabel}>과거 메모 세션</Text>
                  <Text style={styles.memoText}>
                    {highlightedMemo.before}
                    <Text style={styles.highlightedSentence}>
                      {highlightedMemo.highlighted}
                    </Text>
                    {highlightedMemo.after}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onNavigateToMemo(result.memoId)}
                  style={({ pressed }) => [
                    styles.navigateButton,
                    pressed && styles.navigateButtonPressed,
                  ]}
                >
                  <Text style={styles.navigateButtonText}>이 메모로 이동</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(44, 37, 32, 0.24)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
    minHeight: '42%',
    overflow: 'hidden',
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: {
    color: '#2C2520',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: '#E5DDD0',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    padding: 28,
  },
  emptyText: {
    color: '#9C8E7C',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 22,
  },
  compareSection: {
    backgroundColor: '#F4EEE4',
    borderColor: '#E5DDD0',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    padding: 13,
  },
  sectionLabel: {
    color: '#9C8E7C',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
  },
  queryText: {
    color: '#2C2520',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  resultText: {
    color: '#236B45',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
  },
  memoSection: {
    paddingTop: 4,
  },
  memoText: {
    color: '#2C2520',
    fontSize: 15,
    lineHeight: 24,
  },
  highlightedSentence: {
    backgroundColor: 'rgba(90, 184, 125, 0.32)',
    color: '#1F5F3E',
    fontWeight: '800',
  },
  footer: {
    borderTopColor: '#E5DDD0',
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  navigateButton: {
    alignItems: 'center',
    backgroundColor: '#5C4D3C',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 42,
  },
  navigateButtonPressed: {
    opacity: 0.72,
  },
  navigateButtonText: {
    color: '#FAF6F0',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default AmbientNetworkDetailPanel;
