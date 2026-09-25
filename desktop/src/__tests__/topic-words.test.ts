import { describe, expect, it } from 'vitest';

import {
  eligibleTopicTokenIds,
  rankTopicWords,
  topicPrompt,
} from '../lib/topicWords';

describe('A.X topic words', () => {
  it('한글 여부에 따라 측정한 세 마스크 템플릿을 쓴다', () => {
    expect(topicPrompt('치과 예약')).toBe(
      '치과 예약 관련 단어: <mask>, <mask>, <mask>.',
    );
    expect(topicPrompt('Book a dentist')).toBe(
      'Book a dentist Related words: <mask>, <mask>, <mask>.',
    );
  });

  it('특수·조각·숫자·영어 기능어를 후보에서 제외한다', () => {
    expect(
      eligibleTopicTokenIds(
        ['<mask>', '치과', '##의', '가', '123', 'dentist', 'the', '서울', 'food'],
        [0],
      ),
    ).toEqual([1, 5, 7, 8]);
  });

  it('세 마스크의 softmax 최대값으로 상위 16개를 고른 뒤 범용어를 빼고 8개를 남긴다', () => {
    const words = Array.from({ length: 17 }, (_, i) => `주제${String.fromCharCode(0xac00 + i)}`);
    const tokens = ['정리', ...words];
    // 범용어 '정리'가 최고점, 16번째 후보는 words[14]다.
    const logits = new Float32Array(tokens.length * 3);
    for (let row = 0; row < 3; row += 1) {
      tokens.forEach((_, id) => {
        logits[row * tokens.length + id] = tokens.length - id;
      });
    }
    expect(rankTopicWords(logits, tokens.length, [0, 1, 2], tokens, tokens.map((_, i) => i)))
      .toEqual(words.slice(0, 8));
  });
});
