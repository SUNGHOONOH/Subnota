import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfToday } from 'date-fns';

import { useMemoStore } from '../../store/useMemoStore';
import {
  DailyBriefing,
  fetchDailyBriefings,
} from '../../services/supabase/briefingService';
import {
  ScheduleInboxItem,
  fetchPendingScheduleInbox,
  updateScheduleInboxStatus,
} from '../../services/supabase/scheduleInboxService';
import { requireOnlineLogin } from '../../services/supabase/authGate';
import { syncLocalData } from '../../services/supabase/syncService';
import PriorityQueue from './components/PriorityQueue';
import TodayContextPanel from './components/TodayContextPanel';

const formatInboxDate = (timestamp: number) => {
  return format(new Date(timestamp), 'M월 d일 HH:mm');
};

const formatBriefingDate = (briefing: DailyBriefing) => {
  if (briefing.briefingDate) {
    return format(new Date(`${briefing.briefingDate}T00:00:00`), 'M월 d일');
  }

  return format(new Date(briefing.createdAt), 'M월 d일');
};

const getBriefingPreview = (content: string) => {
  const firstLine =
    content
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) ?? '아직 브리핑이 없습니다.';

  return firstLine.length > 58 ? `${firstLine.slice(0, 58)}...` : firstLine;
};

const applyTimeDraft = (timestamp: number, timeText: string) => {
  if (!/^\d{1,2}:\d{2}$/.test(timeText.trim())) {
    return timestamp;
  }

  const [hour, minute] = timeText.split(':').map(Number);
  if (hour > 23 || minute > 59) {
    return timestamp;
  }

  const date = new Date(timestamp);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

const BriefingScreen = () => {
  const { width } = useWindowDimensions();
  const memos = useMemoStore(state => state.memos);
  const addCalendarBrick = useMemoStore(state => state.addCalendarBrick);
  const [editingInboxId, setEditingInboxId] = useState<string | null>(null);
  const [inboxDraftTitle, setInboxDraftTitle] = useState('');
  const [inboxDraftTime, setInboxDraftTime] = useState('');
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxItems, setInboxItems] = useState<ScheduleInboxItem[]>([]);
  const [isInboxLoading, setInboxLoading] = useState(false);
  const [isInboxOpen, setInboxOpen] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingItems, setBriefingItems] = useState<DailyBriefing[]>([]);
  const [isBriefingInboxLoading, setBriefingInboxLoading] = useState(false);
  const [isBriefingInboxOpen, setBriefingInboxOpen] = useState(false);
  const [selectedBriefing, setSelectedBriefing] =
    useState<DailyBriefing | null>(null);

  const loadScheduleInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);

    try {
      await syncLocalData({ force: true });
      const items = await fetchPendingScheduleInbox();
      setInboxItems(items);
    } catch {
      setInboxError('온라인 일정 inbox를 불러오지 못했습니다.');
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const loadBriefingInbox = useCallback(async () => {
    setBriefingInboxLoading(true);
    setBriefingError(null);

    try {
      const items = await fetchDailyBriefings();
      setBriefingItems(items);
    } catch {
      setBriefingError('과거 브리핑을 불러오지 못했습니다.');
    } finally {
      setBriefingInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduleInbox();
    loadBriefingInbox();
  }, [loadBriefingInbox, loadScheduleInbox]);

  const latestBriefing = briefingItems[0] ?? null;

  const openBriefingInbox = async () => {
    const canUseBriefingInbox = await requireOnlineLogin('과거 브리핑 인박스');

    if (canUseBriefingInbox) {
      setBriefingInboxOpen(true);
    }
  };

  const openScheduleInbox = async () => {
    const canUseScheduleInbox = await requireOnlineLogin('흩어진 일정 모아보기');

    if (canUseScheduleInbox) {
      setInboxOpen(true);
    }
  };

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

  const startEditingInboxItem = (item: ScheduleInboxItem) => {
    setEditingInboxId(item.id);
    setInboxDraftTitle(item.title);
    setInboxDraftTime(item.timeText ?? format(new Date(item.scheduledAt), 'HH:mm'));
  };

  const removeInboxItem = (id: string) => {
    setInboxItems(previous => previous.filter(item => item.id !== id));
    if (editingInboxId === id) {
      setEditingInboxId(null);
    }
  };

  const acceptInboxItem = async (item: ScheduleInboxItem) => {
    const isEditing = editingInboxId === item.id;
    const title = isEditing ? inboxDraftTitle.trim() || item.title : item.title;
    const scheduledAt = isEditing
      ? applyTimeDraft(item.scheduledAt, inboxDraftTime)
      : item.scheduledAt;
    const date = new Date(scheduledAt);
    const timeText =
      date.getHours() === 0 && date.getMinutes() === 0
        ? null
        : format(date, 'HH:mm');

    addCalendarBrick({
      day: date.getDay(),
      note: item.sourceText,
      scheduledAt,
      time: timeText,
      title,
      tone: 'olive',
    });
    removeInboxItem(item.id);

    try {
      await syncLocalData({ force: true });
      await updateScheduleInboxStatus(item.id, 'accepted');
    } catch {
      setInboxError('등록은 로컬에 완료됐지만 inbox 상태 동기화에 실패했습니다.');
    }
  };

  const dismissInboxItem = async (item: ScheduleInboxItem) => {
    removeInboxItem(item.id);

    try {
      await updateScheduleInboxStatus(item.id, 'dismissed');
    } catch {
      setInboxError('inbox 상태 동기화에 실패했습니다.');
    }
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
            <Text style={styles.subtitle}>오늘의 정리와 기억 인박스</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            disabled={!latestBriefing}
            onPress={() => {
              if (latestBriefing) {
                setSelectedBriefing(latestBriefing);
              }
            }}
            style={({ pressed }) => [
              styles.latestBriefingCard,
              pressed && latestBriefing && styles.inboxCardPressed,
            ]}
          >
            <Text style={styles.latestBriefingLabel}>최근 브리핑</Text>
            <Text style={styles.latestBriefingTitle}>
              {latestBriefing
                ? formatBriefingDate(latestBriefing)
                : '아직 생성된 브리핑이 없습니다'}
            </Text>
            <Text style={styles.latestBriefingContent} numberOfLines={7}>
              {latestBriefing
                ? latestBriefing.content
                : '저녁 batch가 실행되면 내일 일정, 최근 메모, 한 달 전쯤의 생각을 엮은 브리핑이 여기에 표시됩니다.'}
            </Text>
          </Pressable>
          <PriorityQueue memos={priorityMemos} />
          <TodayContextPanel scheduledMemos={scheduledMemos} />
          <Pressable
            onPress={openBriefingInbox}
            style={({ pressed }) => [
              styles.briefingInboxCard,
              pressed && styles.inboxCardPressed,
            ]}
          >
            <View style={styles.briefingInboxCopy}>
              <Text style={styles.inboxTitle}>과거 브리핑 인박스</Text>
              <Text style={styles.inboxSubtitle}>
                {latestBriefing
                  ? `${formatBriefingDate(latestBriefing)} · ${getBriefingPreview(
                      latestBriefing.content,
                    )}`
                  : '한 달 전쯤의 생각을 엮은 데일리 브리핑이 쌓입니다'}
              </Text>
            </View>
            <Text style={styles.inboxCount}>
              {isBriefingInboxLoading ? '...' : briefingItems.length}
            </Text>
          </Pressable>
          {briefingError && (
            <Text style={styles.inboxError}>{briefingError}</Text>
          )}
          <Pressable
            onPress={openScheduleInbox}
            style={({ pressed }) => [
              styles.inboxCard,
              pressed && styles.inboxCardPressed,
            ]}
          >
            <View>
              <Text style={styles.inboxTitle}>흩어진 일정 모아보기</Text>
              <Text style={styles.inboxSubtitle}>
                저녁 batch가 찾은 후보를 여기서 정리합니다
              </Text>
            </View>
            <Text style={styles.inboxCount}>
              {isInboxLoading ? '...' : inboxItems.length}
            </Text>
          </Pressable>
          {inboxError && <Text style={styles.inboxError}>{inboxError}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        onRequestClose={() => setInboxOpen(false)}
        transparent
        visible={isInboxOpen}
      >
        <Pressable
          accessibilityLabel="일정 inbox 닫기"
          onPress={() => setInboxOpen(false)}
          style={styles.sheetBackdrop}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>흩어진 일정</Text>
              <Text style={styles.sheetSubtitle}>
                캘린더에 넣을 후보만 골라 등록하세요
              </Text>
            </View>
            <Pressable onPress={loadScheduleInbox} style={styles.refreshButton}>
              <Text style={styles.refreshText}>새로고침</Text>
            </Pressable>
          </View>

          {inboxItems.length === 0 ? (
            <Text style={styles.emptyInboxText}>
              아직 쌓인 일정 후보가 없습니다. 저녁 batch 이후 표시됩니다.
            </Text>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={Math.max(280, width - 52)}
              decelerationRate="fast"
            >
              {inboxItems.map(item => {
                const isEditing = editingInboxId === item.id;

                return (
                  <View
                    key={item.id}
                    style={[styles.inboxItemCard, { width: width - 52 }]}
                  >
                    <Text style={styles.inboxItemDate}>
                      {formatInboxDate(item.scheduledAt)}
                    </Text>
                    {isEditing ? (
                      <>
                        <TextInput
                          onChangeText={setInboxDraftTitle}
                          style={styles.inboxEditInput}
                          value={inboxDraftTitle}
                        />
                        <TextInput
                          keyboardType="numbers-and-punctuation"
                          onChangeText={setInboxDraftTime}
                          placeholder="HH:mm"
                          placeholderTextColor="#9C8E7C"
                          style={styles.inboxEditInput}
                          value={inboxDraftTime}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={styles.inboxItemTitle}>{item.title}</Text>
                        <Text style={styles.inboxItemSource} numberOfLines={3}>
                          {item.sourceText}
                        </Text>
                      </>
                    )}

                    <View style={styles.inboxActions}>
                      <Pressable
                        onPress={() => acceptInboxItem(item)}
                        style={styles.primaryInboxAction}
                      >
                        <Text style={styles.primaryInboxActionText}>
                          캘린더에 등록
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => startEditingInboxItem(item)}
                        style={styles.secondaryInboxAction}
                      >
                        <Text style={styles.secondaryInboxActionText}>
                          시간 / 제목 수정
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => dismissInboxItem(item)}
                        style={styles.secondaryInboxAction}
                      >
                        <Text style={styles.secondaryInboxActionText}>
                          무시
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setBriefingInboxOpen(false)}
        transparent
        visible={isBriefingInboxOpen}
      >
        <Pressable
          accessibilityLabel="브리핑 inbox 닫기"
          onPress={() => setBriefingInboxOpen(false)}
          style={styles.sheetBackdrop}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>과거 브리핑</Text>
              <Text style={styles.sheetSubtitle}>
                매일 저녁 생성된 브리핑을 모아봅니다
              </Text>
            </View>
            <Pressable onPress={loadBriefingInbox} style={styles.refreshButton}>
              <Text style={styles.refreshText}>새로고침</Text>
            </Pressable>
          </View>

          {briefingItems.length === 0 ? (
            <Text style={styles.emptyInboxText}>
              아직 저장된 데일리 브리핑이 없습니다.
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {briefingItems.map(item => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedBriefing(item)}
                  style={({ pressed }) => [
                    styles.briefingRow,
                    pressed && styles.briefingRowPressed,
                  ]}
                >
                  <Text style={styles.briefingRowDate}>
                    {formatBriefingDate(item)}
                  </Text>
                  <Text style={styles.briefingRowPreview} numberOfLines={2}>
                    {getBriefingPreview(item.content)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedBriefing(null)}
        transparent
        visible={Boolean(selectedBriefing)}
      >
        <View style={styles.detailBackdrop}>
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>데일리 브리핑</Text>
                {selectedBriefing && (
                  <Text style={styles.detailDate}>
                    {formatBriefingDate(selectedBriefing)}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setSelectedBriefing(null)}
                style={styles.refreshButton}
              >
                <Text style={styles.refreshText}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.detailContent}>
                {selectedBriefing?.content}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF6F0',
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
    color: '#2C2520',
    fontSize: 31,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9C8E7C',
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  latestBriefingCard: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  latestBriefingLabel: {
    color: '#8B7355',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  latestBriefingTitle: {
    color: '#2C2520',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  latestBriefingContent: {
    color: '#3A352E',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
  },
  inboxCard: {
    alignItems: 'center',
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  briefingInboxCard: {
    alignItems: 'center',
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  briefingInboxCopy: {
    flex: 1,
    paddingRight: 12,
  },
  inboxCardPressed: {
    opacity: 0.68,
  },
  inboxTitle: {
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '800',
  },
  inboxSubtitle: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  inboxCount: {
    color: '#5C4D3C',
    fontSize: 24,
    fontWeight: '900',
  },
  inboxError: {
    color: '#B5453A',
    fontSize: 12,
    fontWeight: '700',
    paddingTop: 8,
  },
  section: {
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#2C2520',
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
    color: '#8B7355',
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
  priorityCopy: {
    flex: 1,
  },
  priorityTitle: {
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '800',
  },
  priorityMeta: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  emptyText: {
    color: '#9C8E7C',
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleLine: {
    color: '#3A352E',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 5,
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(44, 37, 32, 0.24)',
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FAF6F0',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    bottom: 0,
    left: 0,
    maxHeight: '72%',
    paddingBottom: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D8CEBC',
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 42,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    color: '#2C2520',
    fontSize: 21,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  refreshButton: {
    borderColor: '#E5DDD0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  refreshText: {
    color: '#5C4D3C',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyInboxText: {
    color: '#9C8E7C',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 26,
    textAlign: 'center',
  },
  inboxItemCard: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 12,
    minHeight: 250,
    padding: 16,
  },
  inboxItemDate: {
    color: '#8B7355',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  inboxItemTitle: {
    color: '#2C2520',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  inboxItemSource: {
    color: '#5C4D3C',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 10,
  },
  inboxEditInput: {
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  inboxActions: {
    gap: 8,
    marginTop: 'auto',
  },
  primaryInboxAction: {
    alignItems: 'center',
    backgroundColor: '#5C4D3C',
    borderRadius: 7,
    paddingVertical: 11,
  },
  primaryInboxActionText: {
    color: '#FAF6F0',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryInboxAction: {
    alignItems: 'center',
    borderColor: '#E5DDD0',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  secondaryInboxActionText: {
    color: '#5C4D3C',
    fontSize: 12,
    fontWeight: '800',
  },
  briefingRow: {
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  briefingRowPressed: {
    opacity: 0.66,
  },
  briefingRowDate: {
    color: '#8B7355',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  briefingRowPreview: {
    color: '#2C2520',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  detailBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(44, 37, 32, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  detailPanel: {
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
    padding: 18,
    width: '100%',
  },
  detailHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
  },
  detailTitle: {
    color: '#2C2520',
    fontSize: 20,
    fontWeight: '900',
  },
  detailDate: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  detailContent: {
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
  },
});

export default BriefingScreen;
