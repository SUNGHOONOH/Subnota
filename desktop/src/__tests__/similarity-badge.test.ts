import { describe, expect, it } from 'vitest';

import { matchKindLabel } from '../lib/similarityBadge';

describe('matchKindLabel', () => {
  it('실제 결과 배지는 유사와 관련을 한국어·영어로 표시한다', () => {
    expect(matchKindLabel('similarity', 'ko')).toBe('유사');
    expect(matchKindLabel('similarity', 'en')).toBe('Similar');
    expect(matchKindLabel('relatedness', 'ko')).toBe('관련');
    expect(matchKindLabel('relatedness', 'en')).toBe('Related');
  });
});
