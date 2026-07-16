import { describe, expect, it } from 'vitest';

import { chunkMemoText, getCursorContextText } from '../lib/memoChunker';

// 회귀 재현: 한 문단(줄바꿈 없음)에 여러 문장이 들어있는 노트. 네트워크 검색
// 쿼리가 문단 전체(=노트 전체)로 나가면 통짜 블록으로 임베딩되는 버그가 있었다.
const SINGLE_PARAGRAPH_MEMO =
  '자갈치 회, 밀면, 돼지국밥을 하루 안에 다 넣으면 동선이 빡빡하다. ' +
  '첫날은 광안리 숙소에 짐을 두고 해변 산책을 한다. ' +
  '다음날 아침에 돼지국밥을 먹고 점심은 밀면으로 마무리한다. ' +
  '핵심은 이동 시간을 줄이는 것.';

const texts = (input: string) => chunkMemoText(input).map(chunk => chunk.text);

describe('memoChunker sentence segmentation', () => {
  it('splits a newline-free multi-sentence paragraph into sentence chunks', () => {
    const chunks = chunkMemoText(SINGLE_PARAGRAPH_MEMO);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks[0].text).toContain('동선이 빡빡하다');
    expect(chunks[0].text).not.toContain('해변 산책');
  });

  it('returns a cursor sentence window, never the whole note', () => {
    const context = getCursorContextText(SINGLE_PARAGRAPH_MEMO, 0);
    expect(context.length).toBeGreaterThan(0);
    expect(context.length).toBeLessThan(SINGLE_PARAGRAPH_MEMO.length);
    expect(context).toContain('동선이 빡빡하다');
    expect(context).not.toContain('핵심은 이동 시간을');
  });
});

describe('memoChunker Korean ending false positives', () => {
  it('does not split after 음/임/함-final nouns (다음, 처음, 마음, 게임, 포함)', () => {
    expect(
      texts('다음 주 월요일에 처음 보는 사람과 마음 편히 얘기했다.'),
    ).toEqual(['다음 주 월요일에 처음 보는 사람과 마음 편히 얘기했다.']);
    expect(texts('게임 하고 싶다')).toEqual(['게임 하고 싶다']);
    expect(texts('포함 여부는 나중에 정한다')).toEqual([
      '포함 여부는 나중에 정한다',
    ]);
  });

  it('still splits note-style 음슴체 endings (했음, 좋음, 정리됨, 것임)', () => {
    expect(texts('어제 돼지국밥 먹었음 진짜 맛있었음')).toEqual([
      '어제 돼지국밥 먹었음',
      '진짜 맛있었음',
    ]);
    expect(texts('보고서 정리됨 내일 제출해야 함 회의 준비할 것')).toEqual([
      '보고서 정리됨',
      '내일 제출해야 함',
      '회의 준비할 것',
    ]);
    expect(texts('이건 임시 저장된 것임 확인 필요')).toEqual([
      '이건 임시 저장된 것임',
      '확인 필요',
    ]);
  });

  it('splits ㅆ받침+다 plain endings but keeps 갔다 왔다 together', () => {
    expect(texts('돈가스 먹었다 진짜 맛있었다')).toEqual([
      '돈가스 먹었다',
      '진짜 맛있었다',
    ]);
    expect(texts('부산 갔다 왔다')).toEqual(['부산 갔다 왔다']);
  });

  it('does not split "~할 것 같다"', () => {
    expect(texts('내일 비가 올 텐데 우산 챙겨야 할 것 같다')).toEqual([
      '내일 비가 올 텐데 우산 챙겨야 할 것 같다',
    ]);
  });

  it('treats emoticon runs and 야지 as boundaries', () => {
    expect(texts('개웃겼음ㅋㅋ 다음에 또 가야지 예약 필수')).toEqual([
      '개웃겼음ㅋㅋ',
      '다음에 또 가야지',
      '예약 필수',
    ]);
  });
});

describe('memoChunker English and mixed text', () => {
  it('does not split at abbreviations or lowercase continuations', () => {
    expect(texts('Dr. Kim visited Seoul. He met Mr. Lee at 3 p.m. yesterday.')).toEqual([
      'Dr. Kim visited Seoul.',
      'He met Mr. Lee at 3 p.m. yesterday.',
    ]);
  });

  it('splits after closing quotes but not before Korean quote continuations', () => {
    expect(texts('He said "Stop." Then he left.')).toEqual([
      'He said "Stop."',
      'Then he left.',
    ]);
    expect(texts('그는 "오늘은 좋다." 라고 말했다. 나는 동의했다.')).toEqual([
      '그는 "오늘은 좋다." 라고 말했다.',
      '나는 동의했다.',
    ]);
  });

  it('keeps decimals and versions intact', () => {
    expect(texts('가격은 3.5만원이다. 버전은 v2.1.3으로 올린다.')).toEqual([
      '가격은 3.5만원이다.',
      '버전은 v2.1.3으로 올린다.',
    ]);
  });
});

describe('memoChunker line-block window', () => {
  const MULTILINE_MEMO =
    '부산 여행 준비물 목록\n' +
    '국밥집은 아침에 간다. 밀면은 점심에 먹는다.\n' +
    '지도 앱 미리 받아두기';

  it('keeps the cursor window inside the cursor line', () => {
    // 커서가 둘째 줄 첫 문장에 있을 때: 같은 줄의 두 문장만, 다른 줄 제외.
    const cursor = MULTILINE_MEMO.indexOf('국밥집') + 2;
    const context = getCursorContextText(MULTILINE_MEMO, cursor);
    expect(context).toBe('국밥집은 아침에 간다.\n밀면은 점심에 먹는다.');
  });

  it('returns only the cursor line for single-sentence lines', () => {
    const cursor = MULTILINE_MEMO.indexOf('지도 앱') + 2;
    expect(getCursorContextText(MULTILINE_MEMO, cursor)).toBe(
      '지도 앱 미리 받아두기',
    );
  });
});
