import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MemoChunk } from '../../../lib/memoChunker';
import { NetworkSearchResult } from '../../../services/backend/networkService';

interface AmbientNetworkCardProps {
  onPress: () => void;
  queryChunk: MemoChunk;
  result: NetworkSearchResult;
}

const snippet = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 64 ? `${normalized.slice(0, 64)}...` : normalized;
};

const formatAge = (timestamp: number | null) => {
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

const sourceLabel = (result: NetworkSearchResult) => {
  if (result.sourceKind === 'inbox') {
    return result.sourceLabel ?? '수집함';
  }
  return `${formatAge(result.memoCreatedAt)} 메모`;
};

const AmbientNetworkCard = ({
  onPress,
  queryChunk,
  result,
}: AmbientNetworkCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>비슷한 기억</Text>
        <Text style={styles.meta}>{sourceLabel(result)}</Text>
      </View>
      <Text style={styles.query} numberOfLines={1}>
        {snippet(queryChunk.text)}
      </Text>
      <Text style={styles.result} numberOfLines={2}>
        {snippet(result.chunkText)}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: 'rgba(250, 246, 240, 0.88)',
    borderColor: 'rgba(92, 77, 60, 0.16)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 360,
    opacity: 0.78,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    width: '92%',
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  kicker: {
    color: '#5C4D3C',
    fontSize: 11,
    fontWeight: '800',
  },
  meta: {
    color: '#9C8E7C',
    fontSize: 10,
    fontWeight: '700',
  },
  query: {
    color: '#9C8E7C',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  result: {
    color: '#2C2520',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
});

export default AmbientNetworkCard;
