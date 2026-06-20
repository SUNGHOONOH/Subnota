import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';

import PlatformModal from '../../components/PlatformModal';
import {
  InboxSession,
  fetchInboxSessions,
  saveInboxSession,
} from './services/inboxApi';
import { listLocalInboxSessions } from './services/localInboxQueue';
import { recordMenuBarInboxSave } from '../../shared/native/subnotaMenuBar';
import { subscribeInboxItemSaved } from './inboxEvents';
import { useMemoStore } from '../../store/useMemoStore';
import {
  ScheduleInboxItem,
  fetchPendingScheduleInbox,
  updateScheduleInboxStatus,
} from './services/scheduleInboxService';
import { requireOnlineLogin } from '../../shared/supabase/authGate';
import { syncLocalData } from '../../app/sync/syncService';

export interface InboxPlatformConfig {
  isMac: boolean;
}

const sourceLabels: Record<InboxSession['sourceType'], string> = {
  image: '이미지',
  instagram: 'Instagram',
  url: 'URL',
  youtube: 'YouTube',
};

const statusLabels: Record<InboxSession['summaryStatus'], string> = {
  failed: '요약 실패',
  partial: '일부 저장',
  pending: '요약 준비 중',
  ready: '핵심 요약 완료',
  unsupported: '요약 불가',
};

const inboxUrlKey = (item: InboxSession) =>
  (item.canonicalUrl ?? item.originalUrl ?? '').trim();

const formatDuration = (duration: string | null) => {
  if (!duration) {
    return null;
  }

  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatInboxDate = (timestamp: number) => {
  return format(new Date(timestamp), 'M월 d일 HH:mm');
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

const InboxScreen = ({ platformConfig }: { platformConfig: InboxPlatformConfig }) => {
  const { width } = useWindowDimensions();
  const addCalendarBrick = useMemoStore(state => state.addCalendarBrick);
  const [editingInboxId, setEditingInboxId] = useState<string | null>(null);
  const [inboxDraftTitle, setInboxDraftTitle] = useState('');
  const [inboxDraftTime, setInboxDraftTime] = useState('');
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxItems, setInboxItems] = useState<ScheduleInboxItem[]>([]);
  const [isInboxLoading, setInboxLoading] = useState(false);
  const [isInboxOpen, setInboxOpen] = useState(false);
  const urlInputRef = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InboxSession[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InboxSession | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [animatedItemId, setAnimatedItemId] = useState<string | null>(null);
  const newItemProgress = React.useRef(new Animated.Value(1)).current;

  const animateNewItem = useCallback((itemId: string) => {
    setAnimatedItemId(itemId);
    newItemProgress.setValue(0);
    Animated.timing(newItemProgress, {
      duration: 260,
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      setAnimatedItemId(current => (current === itemId ? null : current));
    });
  }, [newItemProgress]);

  const prependInboxItem = useCallback((item: InboxSession) => {
    setItems(previous => {
      const itemUrlKey = inboxUrlKey(item);
      return [
        item,
        ...previous.filter(previousItem => {
          if (previousItem.id === item.id) {
            return false;
          }
          return !itemUrlKey || inboxUrlKey(previousItem) !== itemUrlKey;
        }),
      ];
    });
    animateNewItem(item.id);
  }, [animateNewItem]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncLocalData({ force: true }).catch(() => undefined);
      const localItems = await listLocalInboxSessions();
      const remoteItems = await fetchInboxSessions();
      const localClientIds = new Set(localItems.map(item => item.clientId));
      setItems([
        ...localItems,
        ...remoteItems.filter(item => !item.clientId || !localClientIds.has(item.clientId)),
      ]);
    } catch (caught) {
      const localItems = await listLocalInboxSessions();
      setItems(localItems);
      setError(
        localItems.length > 0
          ? '온라인 수집함은 불러오지 못했습니다. 오프라인 저장 항목만 표시합니다.'
          : caught instanceof Error
            ? caught.message
            : '수집함을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

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

  const openScheduleInbox = async () => {
    const canUseScheduleInbox = await requireOnlineLogin('흩어진 일정 모아보기');
    if (canUseScheduleInbox) {
      setInboxOpen(true);
    }
  };

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

  useEffect(() => {
    loadInbox();
    loadScheduleInbox();
  }, [loadInbox, loadScheduleInbox]);

  useEffect(() => {
    return subscribeInboxItemSaved(prependInboxItem);
  }, [prependInboxItem]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        urlInputRef.current?.blur();
      };
    }, []),
  );

  const saveUrl = async () => {
    const url = urlDraft.trim();
    if (!url) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const item = await saveInboxSession({ url });
      prependInboxItem(item);
      recordMenuBarInboxSave(item);
      setUrlDraft('');
      setTimeout(() => {
        loadInbox();
      }, 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '링크를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>수집함</Text>
          <Text style={styles.subtitle}>공유한 링크와 나중에 이어볼 단서</Text>
        </View>
      </View>

      <View style={styles.captureCard}>
        <Text style={styles.captureLabel}>링크 직접 저장</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={urlInputRef}
            autoCapitalize="none"
            autoCorrect={false}
            // @ts-ignore
            enableFocusRing={false}
            keyboardType="url"
            onChangeText={setUrlDraft}
            onSubmitEditing={saveUrl}
            placeholder="YouTube, Instagram, 웹 링크"
            placeholderTextColor="#A89C8F"
            style={styles.input}
            value={urlDraft}
          />
          <Pressable
            disabled={isSaving || !urlDraft.trim()}
            onPress={saveUrl}
            focusable={false}
            // @ts-ignore
            enableFocusRing={false}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || isSaving) && styles.saveButtonPressed,
              !urlDraft.trim() && styles.saveButtonDisabled,
            ]}
          >
            <Text style={styles.saveButtonText}>{isSaving ? '저장 중' : '저장'}</Text>
          </Pressable>
        </View>
        <Text style={styles.captureHint}>
          iOS 공유 확장과 macOS/Chrome quick capture도 이 수집함에 저장됩니다.
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadInbox} />
        }
      >
        <Pressable
          onPress={openScheduleInbox}
          focusable={false}
          // @ts-ignore
          enableFocusRing={false}
          style={({ pressed }) => [
            styles.scheduleInboxCard,
            pressed && styles.scheduleInboxCardPressed,
          ]}
        >
          <View>
            <Text style={styles.scheduleInboxTitle}>흩어진 일정 모아보기</Text>
            <Text style={styles.scheduleInboxSubtitle}>
              저녁 batch가 찾은 후보를 여기서 정리합니다
            </Text>
          </View>
          <Text style={styles.scheduleInboxCount}>
            {isInboxLoading ? '...' : inboxItems.length}
          </Text>
        </Pressable>

        {inboxError && <Text style={styles.scheduleInboxError}>{inboxError}</Text>}
        {isLoading && items.length === 0 ? (
          <ActivityIndicator color="#8B7355" />
        ) : null}

        {items.map(item => {
          const duration = formatDuration(item.duration);
          const oneLiner = item.summaryOneLiner ?? item.summary;
          const sourceLabel = sourceLabels[item.sourceType];
          const statusText =
            item.isLocalOnly
              ? item.syncStatus === 'failed'
                ? '동기화 대기'
                : '오프라인 저장됨'
              : statusLabels[item.summaryStatus];
          const metaText = [
            item.channelTitle ?? item.domain,
            duration,
          ].filter(Boolean).join(' · ');
          const card = (
            <Pressable
              key={item.id}
              onPress={() => setSelectedItem(item)}
              focusable={false}
              // @ts-ignore
              enableFocusRing={false}
              style={({ pressed }) => [
                styles.itemCard,
                pressed && styles.itemCardPressed,
              ]}
            >
              <View style={styles.thumbnailWrap}>
                {item.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Text style={styles.thumbnailPlaceholderText}>
                      {sourceLabel.slice(0, 1)}
                    </Text>
                  </View>
                )}
                {duration ? (
                  <Text style={styles.durationBadge}>{duration}</Text>
                ) : null}
              </View>

              <View style={styles.itemBody}>
                <View style={styles.itemHeader}>
                  <Text style={styles.sourcePill}>{sourceLabel}</Text>
                  <Text numberOfLines={1} style={styles.statusText}>
                    {statusText}
                  </Text>
                </View>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title ?? item.originalUrl ?? '제목을 가져오는 중'}
                </Text>
                {metaText ? (
                  <Text numberOfLines={1} style={styles.domainText}>
                    {metaText}
                  </Text>
                ) : null}
                {oneLiner ? (
                  <Text numberOfLines={2} style={styles.summaryText}>{oneLiner}</Text>
                ) : (
                  <Text numberOfLines={1} style={styles.emptySummaryText}>
                    {item.isLocalOnly
                      ? '온라인이 되면 수집함에 동기화합니다.'
                      : '핵심 요약을 준비하고 있습니다.'}
                  </Text>
                )}
              </View>
            </Pressable>
          );

          if (item.id !== animatedItemId) {
            return card;
          }

          return (
            <Animated.View
              key={item.id}
              style={{
                opacity: newItemProgress,
                transform: [
                  {
                    translateY: newItemProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                  {
                    scale: newItemProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              }}
            >
              {card}
            </Animated.View>
          );
        })}

        {!isLoading && items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>아직 수집한 링크가 없습니다.</Text>
            <Text style={styles.emptyText}>
              공유하거나 링크를 붙여넣으면 YouTube, Instagram, 웹 링크를 자동으로 구분합니다.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <PlatformModal
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
        transparent
        visible={selectedItem !== null}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedItem(null)} focusable={false} />
          {selectedItem ? (
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <View style={styles.detailTitleWrap}>
                  <Text style={styles.sourcePill}>
                    {sourceLabels[selectedItem.sourceType]}
                  </Text>
                  <Text style={styles.detailTitle}>
                    {selectedItem.title ?? selectedItem.originalUrl ?? '수집한 링크'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedItem(null)}
                  style={styles.closeButton}
                  focusable={false}
                  // @ts-ignore
                  enableFocusRing={false}
                >
                  <Text style={styles.closeButtonText}>닫기</Text>
                </Pressable>
              </View>

              {(selectedItem.channelTitle || selectedItem.domain) && (
                <Text style={styles.domainText}>
                  {selectedItem.channelTitle ?? selectedItem.domain}
                </Text>
              )}

              <ScrollView style={styles.detailScroll}>
                {selectedItem.summaryDetail ? (
                  <Text style={styles.detailSummaryText}>
                    {selectedItem.summaryDetail}
                  </Text>
                ) : (
                  <Text style={styles.emptySummaryText}>
                    상세 요약을 준비하고 있습니다.
                  </Text>
                )}
              </ScrollView>

              {selectedItem.canonicalUrl || selectedItem.originalUrl ? (
                <Pressable
                  onPress={() => {
                    const url = selectedItem.canonicalUrl ?? selectedItem.originalUrl;
                    if (url) {
                      Linking.openURL(url).catch(() => undefined);
                    }
                  }}
                  style={styles.openSourceButton}
                  focusable={false}
                  // @ts-ignore
                  enableFocusRing={false}
                >
                  <Text style={styles.openSourceButtonText}>원문 열기</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </PlatformModal>

      <PlatformModal
        animationType="slide"
        onRequestClose={() => setInboxOpen(false)}
        transparent
        visible={isInboxOpen}
      >
        <Pressable
          accessibilityLabel="일정 inbox 닫기"
          onPress={() => setInboxOpen(false)}
          style={styles.sheetBackdrop}
          focusable={false}
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
            <Pressable onPress={loadScheduleInbox} style={styles.refreshButton} focusable={false}>
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
                          // @ts-ignore
                          enableFocusRing={false}
                          onChangeText={setInboxDraftTitle}
                          style={styles.inboxEditInput}
                          value={inboxDraftTitle}
                        />
                        <TextInput
                          // @ts-ignore
                          enableFocusRing={false}
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
                        focusable={false}
                      >
                        <Text style={styles.primaryInboxActionText}>
                          캘린더에 등록
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => startEditingInboxItem(item)}
                        style={styles.secondaryInboxAction}
                        focusable={false}
                      >
                        <Text style={styles.secondaryInboxActionText}>
                          시간 / 제목 수정
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => dismissInboxItem(item)}
                        style={styles.secondaryInboxAction}
                        focusable={false}
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
      </PlatformModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  captureCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E8DFD3',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 14,
    maxWidth: Platform.OS === 'macos' ? 720 : undefined,
    alignSelf: Platform.OS === 'macos' ? 'center' : undefined,
    width: Platform.OS === 'macos' ? '100%' : undefined,
  },
  captureHint: {
    color: '#9A8D7C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  captureLabel: {
    color: '#5C4D3C',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  container: {
    backgroundColor: '#FAF9F6',
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#F1E8DD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#5C4D3C',
    fontSize: 12,
    fontWeight: '900',
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailPanel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    maxHeight: '78%',
    padding: 18,
    width: '90%',
    maxWidth: Platform.OS === 'macos' ? 540 : undefined,
  },
  detailScroll: {
    marginTop: 16,
  },
  detailSummaryText: {
    color: '#4D463F',
    fontSize: 15,
    lineHeight: 24,
  },
  detailTitle: {
    color: '#1D1D1F',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 10,
  },
  detailTitleWrap: {
    flex: 1,
  },
  domainText: {
    color: '#9A8D7C',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderRadius: 5,
    bottom: 5,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    right: 5,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 54,
  },
  emptyText: {
    color: '#8E8377',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#2B2825',
    fontSize: 18,
    fontWeight: '800',
  },
  emptySummaryText: {
    color: '#A89C8F',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  errorText: {
    color: '#B5473A',
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 10,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  input: {
    backgroundColor: '#F7F0E7',
    borderRadius: 14,
    color: '#2B2825',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  itemCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: '#E8DFD3',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 92,
    padding: 10,
  },
  itemCardPressed: {
    opacity: 0.72,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  itemTitle: {
    color: '#2B2825',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  thumbnail: {
    backgroundColor: '#EEE3D7',
    height: '100%',
    width: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F1E8DD',
    flex: 1,
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    color: '#8B7355',
    fontSize: 22,
    fontWeight: '900',
  },
  thumbnailWrap: {
    backgroundColor: '#EEE3D7',
    borderRadius: 9,
    height: 72,
    overflow: 'hidden',
    position: 'relative',
    width: 104,
  },
  listContent: {
    gap: 12,
    padding: 18,
    paddingBottom: 42,
    maxWidth: Platform.OS === 'macos' ? 720 : undefined,
    alignSelf: Platform.OS === 'macos' ? 'center' : undefined,
    width: Platform.OS === 'macos' ? '100%' : undefined,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 29, 26, 0.36)',
    flex: 1,
    justifyContent: 'center',
  },
  openSourceButton: {
    alignItems: 'center',
    backgroundColor: '#1D1D1F',
    borderRadius: 14,
    marginTop: 16,
    paddingVertical: 13,
  },
  openSourceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  saveButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonPressed: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sourcePill: {
    backgroundColor: '#F3E4C6',
    borderRadius: 999,
    color: '#8B6427',
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: {
    color: '#8E8377',
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 8,
  },
  subtitle: {
    color: '#8E8377',
    fontSize: 14,
    marginTop: 4,
  },
  summaryText: {
    color: '#5F574F',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  title: {
    color: '#1D1D1F',
    fontSize: 30,
    fontWeight: '900',
  },
  scheduleInboxCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E8DFD3',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: Platform.OS === 'macos' ? 720 : undefined,
    alignSelf: Platform.OS === 'macos' ? 'center' : undefined,
    width: Platform.OS === 'macos' ? '100%' : undefined,
  },
  scheduleInboxCardPressed: {
    opacity: 0.72,
  },
  scheduleInboxTitle: {
    color: '#2C2520',
    fontSize: 15,
    fontWeight: '800',
  },
  scheduleInboxSubtitle: {
    color: '#9E9282',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  scheduleInboxCount: {
    color: '#5C4D3C',
    fontSize: 24,
    fontWeight: '900',
  },
  scheduleInboxError: {
    color: '#B5453A',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 4,
    marginTop: -4,
    marginBottom: 8,
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
});

export default InboxScreen;
