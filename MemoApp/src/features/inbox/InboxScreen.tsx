import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  InboxSession,
  createInboxSession,
  fetchInboxSessions,
} from '../../services/backend/inboxService';
import { recordMenuBarInboxSave } from '../../services/native/subnotaMenuBar';
import { subscribeInboxItemSaved } from './inboxEvents';

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

const InboxScreen = () => {
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
      if (previous.some(previousItem => previousItem.id === item.id)) {
        return previous;
      }
      return [item, ...previous];
    });
    animateNewItem(item.id);
  }, [animateNewItem]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchInboxSessions());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '수집함을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    return subscribeInboxItemSaved(prependInboxItem);
  }, [prependInboxItem]);

  const saveUrl = async () => {
    const url = urlDraft.trim();
    if (!url) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const item = await createInboxSession({ url });
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
            autoCapitalize="none"
            autoCorrect={false}
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
        {isLoading && items.length === 0 ? (
          <ActivityIndicator color="#8B7355" />
        ) : null}

        {items.map(item => {
          const duration = formatDuration(item.duration);
          const oneLiner = item.summaryOneLiner ?? item.summary;
          const card = (
            <Pressable
              key={item.id}
              onPress={() => setSelectedItem(item)}
              style={({ pressed }) => [
                styles.itemCard,
                pressed && styles.itemCardPressed,
              ]}
            >
              {item.thumbnailUrl ? (
                <View style={styles.thumbnailWrap}>
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.thumbnail}
                  />
                  {duration ? (
                    <Text style={styles.durationBadge}>{duration}</Text>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.itemHeader}>
                <Text style={styles.sourcePill}>{sourceLabels[item.sourceType]}</Text>
                <Text style={styles.statusText}>{statusLabels[item.summaryStatus]}</Text>
              </View>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title ?? item.originalUrl ?? '제목을 가져오는 중'}
              </Text>
              {item.channelTitle || item.domain ? (
                <Text style={styles.domainText}>
                  {item.channelTitle ?? item.domain}
                </Text>
              ) : null}
              {oneLiner ? (
                <Text style={styles.summaryText}>{oneLiner}</Text>
              ) : (
                <Text style={styles.emptySummaryText}>
                  핵심 요약을 준비하고 있습니다.
                </Text>
              )}
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

      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
        transparent
        visible={selectedItem !== null}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedItem(null)} />
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
                <Pressable onPress={() => setSelectedItem(null)} style={styles.closeButton}>
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
                >
                  <Text style={styles.openSourceButtonText}>원문 열기</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
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
    backgroundColor: '#FAF6F0',
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
    marginTop: 6,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderRadius: 6,
    bottom: 8,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    right: 8,
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
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
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
    backgroundColor: '#FFFDF8',
    borderColor: '#E8DFD3',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  itemCardPressed: {
    opacity: 0.72,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemTitle: {
    color: '#2B2825',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  thumbnail: {
    aspectRatio: 16 / 9,
    backgroundColor: '#EEE3D7',
    width: '100%',
  },
  thumbnailWrap: {
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  listContent: {
    gap: 12,
    padding: 18,
    paddingBottom: 42,
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
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    color: '#8E8377',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8E8377',
    fontSize: 14,
    marginTop: 4,
  },
  summaryText: {
    color: '#5F574F',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  title: {
    color: '#1D1D1F',
    fontSize: 30,
    fontWeight: '900',
  },
});

export default InboxScreen;
