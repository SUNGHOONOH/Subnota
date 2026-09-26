import { describe, expect, it } from 'vitest';

import { modelDownloadFailure } from '../features/search/useEmbeddingModelDownload';

const t = (korean: string) => korean;

describe('modelDownloadFailure', () => {
  it('두 모델을 모두 받으면 실패가 아니다', () => {
    expect(modelDownloadFailure({ ready: true, topicReady: true }, t)).toBeNull();
  });

  it('BGE는 받았어도 A.X를 못 받으면 다시 시도할 수 있게 실패로 알린다', () => {
    expect(modelDownloadFailure({ ready: true, topicReady: false }, t))
      .toBe('관련 검색 파일을 받지 못했습니다.');
    expect(modelDownloadFailure({ ready: true, topicError: 'network', topicReady: false }, t))
      .toBe('network');
  });

  it('BGE를 못 받으면 그 실패가 먼저다', () => {
    expect(modelDownloadFailure({ error: 'disk', ready: false, topicReady: false }, t)).toBe('disk');
  });
});
