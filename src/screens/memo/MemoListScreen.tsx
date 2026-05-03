import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Save, Trash2 } from 'lucide-react-native';
import { parseDates, formatDisplayDate, DateMatch } from '../../utils/dateParser';
import { useMemoStore } from '../../stores/useMemoStore';

// Android LayoutAnimation 활성화
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ────────────────────────────────────────────
// 날짜 감지 뱃지 컴포넌트 (텍스트 위에 겹치지 않는 인라인 뱃지)
// ────────────────────────────────────────────
interface DateBadgeProps {
  match: DateMatch;
  onCancel: (index: number) => void;
}

const DateBadge: React.FC<DateBadgeProps> = ({ match, onCancel }) => {
  return (
    <View style={badgeStyles.wrapper}>
      {/* 상단 날짜 뱃지 */}
      <View style={badgeStyles.badge}>
        <Text style={badgeStyles.badgeText}>
          📅 {formatDisplayDate(match.date)}
        </Text>
        <TouchableOpacity
          onPress={() => onCancel(match.index)}
          style={badgeStyles.cancelBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={10} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* 하이라이트된 텍스트 */}
      <Text style={badgeStyles.highlightedText}>{match.text}</Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightedText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#007AFF',
    fontWeight: '600',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 2,
  },
});

// ────────────────────────────────────────────
// 메인 메모 화면 (순수 메모장 스타일)
// ────────────────────────────────────────────
const MemoListScreen = () => {
  const [text, setText] = useState('');
  const [cancelledIndices, setCancelledIndices] = useState<number[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { memos, addMemo, deleteMemo } = useMemoStore();

  // 날짜 파싱 결과 (취소된 것 제외)
  const activeMatches = useMemo(() => {
    const all = parseDates(text);
    return all.filter((m) => !cancelledIndices.includes(m.index));
  }, [text, cancelledIndices]);

  const handleCancelMatch = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCancelledIndices((prev) => [...prev, index]);
  }, []);

  const handleSave = useCallback(() => {
    if (!text.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addMemo(text.trim());
    setText('');
    setCancelledIndices([]);
  }, [text, addMemo]);

  const handleDelete = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      deleteMemo(id);
      if (selectedMemoId === id) setSelectedMemoId(null);
    },
    [deleteMemo, selectedMemoId],
  );

  const handleMemoPress = useCallback((id: string, content: string) => {
    setSelectedMemoId(id);
    setText(content);
    setCancelledIndices([]);
    inputRef.current?.focus();
  }, []);

  // ── 하이라이트 미리보기 렌더링 (겹침 없이 인라인) ──
  const renderPreview = () => {
    if (activeMatches.length === 0 || text.length === 0) return null;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    activeMatches.forEach((match) => {
      // 매치 이전 일반 텍스트
      if (match.index > lastIndex) {
        elements.push(
          <Text key={`t-${lastIndex}`} style={styles.previewText}>
            {text.substring(lastIndex, match.index)}
          </Text>,
        );
      }
      // 매치된 날짜 뱃지
      elements.push(
        <DateBadge
          key={`b-${match.index}`}
          match={match}
          onCancel={handleCancelMatch}
        />,
      );
      lastIndex = match.index + match.length;
    });

    // 나머지 텍스트
    if (lastIndex < text.length) {
      elements.push(
        <Text key={`t-${lastIndex}`} style={styles.previewText}>
          {text.substring(lastIndex)}
        </Text>,
      );
    }

    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>감지된 일정</Text>
        <View style={styles.previewContent}>{elements}</View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 메모</Text>
        <Text style={styles.headerSubtitle}>
          {memos.length}개의 메모
        </Text>
      </View>

      {/* 메모 리스트 (저장된 메모들) */}
      <ScrollView
        style={styles.memoList}
        contentContainerStyle={styles.memoListContent}
        keyboardShouldPersistTaps="handled"
      >
        {memos.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗒️</Text>
            <Text style={styles.emptyTitle}>메모가 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              아래 입력란에 메모를 작성해보세요
            </Text>
          </View>
        )}
        {memos.map((memo) => (
          <TouchableOpacity
            key={memo.id}
            style={[
              styles.memoCard,
              selectedMemoId === memo.id && styles.memoCardSelected,
            ]}
            onPress={() => handleMemoPress(memo.id, memo.content)}
            activeOpacity={0.7}
          >
            <View style={styles.memoCardContent}>
              <Text style={styles.memoText} numberOfLines={3}>
                {memo.content}
              </Text>
              <Text style={styles.memoTimestamp}>
                {new Date(memo.createdAt).toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(memo.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={16} color="#FF3B30" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 날짜 감지 미리보기 영역 (텍스트 겹침 없이 별도 영역) */}
      {renderPreview()}

      {/* 하단 입력 영역 (순수 메모장 스타일) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.editorArea}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="메모를 입력하세요... (예: 내일 3시 미팅)"
            placeholderTextColor="#AEAEB2"
            value={text}
            onChangeText={(newText) => {
              setText(newText);
              if (newText.length < text.length) {
                setCancelledIndices([]);
              }
            }}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveButton, !text.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!text.trim()}
          >
            <Save size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // 헤더
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D6',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },

  // 메모 리스트
  memoList: {
    flex: 1,
  },
  memoListContent: {
    padding: 16,
    paddingBottom: 8,
  },

  // 빈 상태
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#AEAEB2',
  },

  // 메모 카드
  memoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  memoCardSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  memoCardContent: {
    flex: 1,
  },
  memoText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1C1C1E',
    fontWeight: '400',
  },
  memoTimestamp: {
    fontSize: 12,
    color: '#AEAEB2',
    marginTop: 6,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },

  // 날짜 감지 프리뷰 (입력 영역 바로 위, 겹침 없음)
  previewContainer: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  previewContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 4,
  },
  previewText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1C1C1E',
  },

  // 에디터
  editorArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    lineHeight: 22,
    color: '#1C1C1E',
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
});

export default MemoListScreen;
