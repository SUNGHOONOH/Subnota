import { describe, expect, it } from 'vitest';

import { embeddingGateCopy } from '../features/search/EmbeddingModelGate';

const t = (korean: string) => korean;

describe('embeddingGateCopy', () => {
  it('처음 받을 때는 받을 크기만 알린다', () => {
    const copy = embeddingGateCopy({ pendingDownloadBytes: 596_120_278, retiredModelBytes: 0 }, t);
    expect(copy.title).toBe('연관 문장 검색 준비');
    expect(copy.body).toContain('약 596MB');
    expect(copy.body).not.toContain('기존 모델');
  });

  // 업데이트로 모델이 바뀐 사용자는 왜 또 받는지와 옛 파일이 지워진다는 걸 알아야 한다.
  it('옛 모델이 남아 있으면 교체라고 알리고 지워질 크기를 보여 준다', () => {
    const copy = embeddingGateCopy({ pendingDownloadBytes: 406_126_989, retiredModelBytes: 569_694_530 }, t);
    expect(copy.title).toBe('검색 모델 업데이트');
    expect(copy.body).toContain('약 406MB');
    expect(copy.body).toContain('기존 모델(약 570MB)은 지워집니다');
  });

  it('상태를 아직 모르면 크기 없이 안내한다', () => {
    const copy = embeddingGateCopy(null, t);
    expect(copy.title).toBe('연관 문장 검색 준비');
    expect(copy.body).not.toMatch(/\d+MB/);
  });
});
