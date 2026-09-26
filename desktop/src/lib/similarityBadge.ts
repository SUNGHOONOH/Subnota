import { localize } from './uiLanguage';

// 배지는 점수가 아니라 결과가 나온 검색 경로로 정한다. 점수는 중심화+CSLS라
// 0~1이 아니고(대략 -0.5 ~ 1.5), 유사·관련 두 경로는 척도도 서로 다르다 —
// 점수 크기로 둘을 가르면 근거 없는 라벨이 된다.
//
// 두 경로는 의미론의 유사성/관련성 구분 그대로다:
//   similarity   같은 뜻을 다른 말로 (wolf ↔ dog) — 본문 벡터 검색
//   relatedness  뜻은 다르지만 이어지는 것 (wolf ↔ moon) — A.X 주제어 벡터 검색
export type MatchKind = 'similarity' | 'relatedness';
export type SimilarityTier = 'similar' | 'related';

const LABELS: Record<SimilarityTier, [korean: string, english: string]> = {
  related: ['관련', 'Related'],
  similar: ['유사', 'Similar'],
};

export const matchKindTier = (kind: MatchKind): SimilarityTier =>
  kind === 'relatedness' ? 'related' : 'similar';

export const matchKindLabel = (kind: MatchKind, language: 'en' | 'ko') => {
  const [korean, english] = LABELS[matchKindTier(kind)];
  return localize(language, korean, english);
};
