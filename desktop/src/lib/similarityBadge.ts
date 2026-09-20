import { AMBIENT_MIN_SIMILARITY } from './constants';
import { localize } from './uiLanguage';

// 점수는 중심화+CSLS 라 0~1 이 아니다(대략 -0.5 ~ 1.5). 그대로 퍼센트로 찍으면
// "유사도 -12%" 나 "143%" 가 나온다. 숫자 대신 두 축으로 말해 준다 —
// 사용자는 점수의 척도를 알 길이 없고, 알 필요도 없다.
//
// 두 축은 의미론의 유사성/관련성 구분 그대로다:
//   similar  같은 뜻을 다른 말로 (wolf ↔ dog)
//   related  뜻은 다르지만 이어지는 것 (wolf ↔ moon)
// 그 외는 "나머지"라 축을 따로 두지 않는다.
export type SimilarityTier = 'similar' | 'related';

// 경계는 하나뿐이고, 자동검색 문턱과 같은 값이다. 실제 크기 메모로 재 보면
// 완전 동일·유사함의 윗부분만 오답과 깨끗이 갈리고(틈: -0.005 ~ 0.113),
// 그 아래는 유사함·관련됨·오답이 전부 겹친다. 근거는 constants.ts 참고.
//
// 그래서 배지는 "이 위 = 유사, 아래 = 관련"으로만 말한다. 자동검색은 문턱
// 위만 띄우므로 사실상 늘 'similar' 고, 'related' 는 사용자가 직접 연
// 더보기 목록(문턱 없음)에서만 나온다.
const SIMILAR_THRESHOLD = AMBIENT_MIN_SIMILARITY;

export const similarityTier = (score: number): SimilarityTier | null => {
  if (!Number.isFinite(score)) return null;
  return score >= SIMILAR_THRESHOLD ? 'similar' : 'related';
};

const LABELS: Record<SimilarityTier, [korean: string, english: string]> = {
  related: ['관련', 'Related'],
  similar: ['비슷함', 'Similar'],
};

/// 그래프 툴팁처럼 JSX 가 아닌 자리에서 쓴다. 컴포넌트는 `SimilarityBadge`.
export const similarityTierLabel = (
  score: number,
  language: 'en' | 'ko',
): string | null => {
  const tier = similarityTier(score);
  if (!tier) return null;
  const [korean, english] = LABELS[tier];
  return localize(language, korean, english);
};
