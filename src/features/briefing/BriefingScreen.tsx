import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startOfToday } from 'date-fns';
import { Sparkles } from 'lucide-react-native';

import { Memo, useMemoStore } from '../../store/useMemoStore';
import BriefingChat, { ChatMessage } from './components/BriefingChat';
import { getMemoTitle } from './components/briefingFormat';
import PriorityQueue from './components/PriorityQueue';
import TodayContextPanel from './components/TodayContextPanel';

const buildPriorityReply = (memos: Memo[]) => {
  const scheduled = memos
    .filter(
      memo => memo.scheduledAt && memo.scheduledAt >= startOfToday().getTime(),
    )
    .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0));
  const pinned = memos.filter(memo => memo.pinned);
  const first = scheduled[0] ?? pinned[0] ?? memos[0];

  if (!first) {
    return '아직 판단할 메모가 없습니다. 먼저 메모나 캘린더 블럭을 추가하면 우선순위를 정리할 수 있습니다.';
  }

  return `지금은 "${getMemoTitle(
    first,
  )}"부터 보는 게 좋겠습니다. 일정이 있는 항목을 먼저 처리하고, 남는 시간에는 고정된 메모를 정리하는 순서가 안전합니다.`;
};

const BriefingScreen = () => {
  const memos = useMemoStore(state => state.memos);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: '오늘의 메모와 캘린더를 기준으로 우선순위를 정리합니다.',
    },
  ]);

  const scheduledMemos = useMemo(() => {
    return memos
      .filter(memo => memo.scheduledAt)
      .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0))
      .slice(0, 5);
  }, [memos]);

  const priorityMemos = useMemo(() => {
    const scheduled = memos
      .filter(
        memo =>
          memo.scheduledAt && memo.scheduledAt >= startOfToday().getTime(),
      )
      .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0));
    const pinned = memos.filter(
      memo => memo.pinned && !scheduled.includes(memo),
    );

    return [
      ...scheduled,
      ...pinned,
      ...memos.filter(memo => !memo.scheduledAt),
    ].slice(0, 4);
  }, [memos]);

  const handleSend = () => {
    const text = draft.trim();

    if (!text) {
      return;
    }

    setMessages(previous => [
      ...previous,
      { id: `user-${Date.now()}`, role: 'user', text },
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: buildPriorityReply(memos),
      },
    ]);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>브리핑</Text>
            <Text style={styles.subtitle}>할 일 우선순위 전용 챗</Text>
          </View>
          <View style={styles.badge}>
            <Sparkles size={15} color="#1D1D1F" />
            <Text style={styles.badgeText}>LOCAL</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PriorityQueue memos={priorityMemos} />
          <TodayContextPanel scheduledMemos={scheduledMemos} />
          <BriefingChat
            draft={draft}
            messages={messages}
            onChangeDraft={setDraft}
            onSend={handleSend}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAF8',
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  title: {
    color: '#1D1D1F',
    fontSize: 31,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8A8A8E',
    fontSize: 13,
    marginTop: 4,
  },
  badge: {
    alignItems: 'center',
    borderColor: '#DEDAD0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#1D1D1F',
    fontSize: 11,
    fontWeight: '800',
  },
  content: {
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  section: {
    borderBottomColor: '#E5E0D6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#1D1D1F',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  priorityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  priorityRank: {
    color: '#A75C4A',
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
  priorityCopy: {
    flex: 1,
  },
  priorityTitle: {
    color: '#1D1D1F',
    fontSize: 15,
    fontWeight: '800',
  },
  priorityMeta: {
    color: '#7A7A7E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  emptyText: {
    color: '#8A8A8E',
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleLine: {
    color: '#3A3A3D',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 5,
  },
  chatLog: {
    paddingTop: 18,
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E0D6',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    maxWidth: '86%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1D1D1F',
    borderColor: '#1D1D1F',
  },
  messageText: {
    color: '#1D1D1F',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  composer: {
    alignItems: 'center',
    borderTopColor: '#E5E0D6',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E0D6',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#1D1D1F',
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#1D1D1F',
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});

export default BriefingScreen;
