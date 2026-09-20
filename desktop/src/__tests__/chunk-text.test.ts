import { describe, expect, it } from 'vitest';

import { hasSearchableContent, normalizeChunkText } from '../lib/chunkText';

describe('normalizeChunkText', () => {
  // 실제 사용자 메모에서 나온 청크. 70자 중 55자가 태그라 "다른 앱 아이디어"가 묻힌다.
  it('하이라이트 마크업을 벗겨 본문만 남긴다', () => {
    const raw =
      '## <mark data-color="var(--tt-color-highlight-green)">다른 앱 아이디어</mark>';
    expect(normalizeChunkText(raw)).toBe('다른 앱 아이디어');
  });

  it('제목·글머리 기호를 뗀다', () => {
    expect(normalizeChunkText('### 배포 후')).toBe('배포 후');
    expect(normalizeChunkText('- 다크모드')).toBe('다크모드');
    expect(normalizeChunkText('* 표 기능')).toBe('표 기능');
  });

  it('엔티티는 지우지 않고 글자로 되돌린다', () => {
    expect(normalizeChunkText('천안시 =&gt; 수도권')).toBe('천안시 => 수도권');
    expect(normalizeChunkText('A &amp; B')).toBe('A & B');
    expect(normalizeChunkText('&nbsp;')).toBe('');
  });

  // 순서가 반대면 `&lt;b&gt;`가 태그로 되살아나 통째로 지워진다.
  it('태그를 먼저 떼고 엔티티를 푼다', () => {
    expect(normalizeChunkText('&lt;b&gt; 는 굵게')).toBe('<b> 는 굵게');
  });

  it('번호 목록은 건드리지 않는다 — 순서가 정보다', () => {
    expect(normalizeChunkText('1. 첫째')).toBe('1. 첫째');
  });

  // `<[^>]+>` 로 잡으면 가운데가 태그로 보여 본문이 통째로 지워진다.
  it('부등호를 태그로 착각하지 않는다', () => {
    expect(normalizeChunkText('조건은 3 < 5 그리고 7 > 2 이다')).toBe(
      '조건은 3 < 5 그리고 7 > 2 이다',
    );
  });

  it('원문에 손댈 게 없으면 그대로 둔다', () => {
    const plain = '무릎 안 아픈 거 보니 러닝화 바꾼 게 효과 있다.';
    expect(normalizeChunkText(plain)).toBe(plain);
  });
});

describe('hasSearchableContent', () => {
  // 내용이 없는 청크는 코퍼스 한가운데에 놓여 아무 질의에나 1등으로 올라온다.
  it('내용 없는 청크를 걸러낸다', () => {
    expect(hasSearchableContent('&nbsp;')).toBe(false);
    expect(hasSearchableContent('1.')).toBe(false);
    expect(hasSearchableContent('교통')).toBe(false);
    expect(hasSearchableContent('# ㅇㅇㅇ')).toBe(false);
  });

  it('뜻이 있는 청크는 남긴다', () => {
    expect(hasSearchableContent('전체적으로 교통의 문제')).toBe(true);
    expect(hasSearchableContent('프롬프트 캐싱으로 비용 절감')).toBe(true);
  });

  // 태그만 많고 본문이 짧은 청크가 기준을 통과하지 못하면 안 된다 —
  // 벗기고 나면 "다른 앱 아이디어"라 충분히 검색된다.
  it('마크업을 벗긴 뒤의 본문으로 판단한다', () => {
    const raw =
      '## <mark data-color="var(--tt-color-highlight-green)">다른 앱 아이디어</mark>';
    expect(hasSearchableContent(raw)).toBe(true);
  });
});
