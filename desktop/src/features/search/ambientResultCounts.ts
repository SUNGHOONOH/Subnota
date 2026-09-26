import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { AmbientSearchTarget } from '../../lib/ambientSearch';

export interface AmbientListCache {
  ownerId: string | null;
  results: NetworkSearchResult[];
  target: AmbientSearchTarget;
}

export const getAdditionalSearchCounts = (
  visible: NetworkSearchResult | null,
  results: NetworkSearchResult[],
) => {
  const counts = { similarity: 0, relatedness: 0 };
  for (const result of results) {
    if (visible && result.chunkId === visible.chunkId &&
      result.sourceKind === visible.sourceKind) continue;
    if (result.matchKind === 'relatedness') counts.relatedness += 1;
    else counts.similarity += 1;
  }
  return counts;
};

export const additionalSearchCountsLabel = (
  counts: { similarity: number; relatedness: number },
  t: (korean: string, english: string) => string,
) => [
  counts.similarity > 0 ? `${t('유사', 'Similar')} ${counts.similarity}` : null,
  counts.relatedness > 0 ? `${t('관련', 'Related')} ${counts.relatedness}` : null,
].filter(Boolean).join(' · ');

export const additionalSearchCountsAriaLabel = (
  counts: { similarity: number; relatedness: number },
  t: (korean: string, english: string) => string,
) => {
  const parts = [
    counts.similarity > 0
      ? t(`유사 결과 ${counts.similarity}건`, `${counts.similarity} similar results`)
      : null,
    counts.relatedness > 0
      ? t(`관련 결과 ${counts.relatedness}건`, `${counts.relatedness} related results`)
      : null,
  ].filter(Boolean);
  return `${parts.join(', ')} ${t('더 보기', 'more')}`;
};
