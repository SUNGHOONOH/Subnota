import { describe, expect, it } from 'vitest';

import { AMBIENT_MIN_SIMILARITY } from '../lib/constants';
import { similarityTier } from '../lib/similarityBadge';

describe('similarityTier', () => {
  it('자동검색 문턱이 두 축을 가르는 경계다', () => {
    expect(similarityTier(AMBIENT_MIN_SIMILARITY)).toBe('similar');
    expect(similarityTier(AMBIENT_MIN_SIMILARITY - 0.01)).toBe('related');
  });

  it('문턱 아래도 배지가 있다 — 더보기 목록은 문턱이 없다', () => {
    expect(similarityTier(-0.5)).toBe('related');
    expect(similarityTier(-1.9)).toBe('related');
  });

  // CSLS 점수는 상한이 1이 아니다. 코사인 시절 가정이 남아 있으면 여기서 깨진다.
  it('1을 넘는 점수도 유사 축이다', () => {
    expect(similarityTier(1.4)).toBe('similar');
  });

  it('숫자가 아니면 배지가 없다', () => {
    expect(similarityTier(Number.NaN)).toBeNull();
    expect(similarityTier(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
