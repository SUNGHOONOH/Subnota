import { describe, expect, it } from 'vitest';

import { mergeMemoContent } from '../lib/mergeMemo';

const BASE = '부산 여행 계획\n첫날은 광안리 산책\n둘째날은 돼지국밥';

describe('mergeMemoContent (3-way merge)', () => {
  it('combines disjoint edits from both sides', () => {
    const local = `${BASE}\n셋째날은 밀면`; // local appended a line
    const server = BASE.replace('광안리 산책', '광안리 숙소에 짐 풀기'); // server edited line 2

    const merged = mergeMemoContent(BASE, local, server);

    expect(merged.ok).toBe(true);
    expect(merged.text).toContain('광안리 숙소에 짐 풀기');
    expect(merged.text).toContain('셋째날은 밀면');
  });

  it('keeps identical content unchanged', () => {
    const merged = mergeMemoContent(BASE, BASE, BASE);
    expect(merged.ok).toBe(true);
    expect(merged.text).toBe(BASE);
  });

  it('fails when the texts diverged beyond patching', () => {
    const merged = mergeMemoContent(
      BASE,
      '완전히 새로 쓴 로컬 메모입니다. 원본과 겹치는 부분이 없습니다.',
      '서버에서도 전부 다시 작성했습니다. 접점이 전혀 없는 내용입니다.',
    );
    expect(merged.ok).toBe(false);
  });
});
