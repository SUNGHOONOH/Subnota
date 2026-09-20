import { useUiLanguage } from '../lib/uiLanguage';
import { similarityTier, similarityTierLabel } from '../lib/similarityBadge';

// 점수를 퍼센트로 보여 주던 자리를 대신한다. 중심화+CSLS 점수는 0~1 이 아니라
// 대략 -0.5 ~ 1.5 라 그대로 찍으면 "유사도 -12%" 나 "143%" 가 나온다.
// 사용자는 이 척도를 알 길이 없으므로 숫자 대신 단계로 말한다.
export const SimilarityBadge = ({ score }: { score: number }) => {
  const language = useUiLanguage();
  const tier = similarityTier(score);
  const label = similarityTierLabel(score, language);
  if (!tier || !label) return null;
  return (
    <span className={`similarity-badge similarity-badge--${tier}`}>{label}</span>
  );
};

export default SimilarityBadge;
