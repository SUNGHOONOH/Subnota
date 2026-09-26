import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAdditionalSearchCounts } from '../features/search/ambientResultCounts';
import type { NetworkSearchResult } from '../services/local/memoSearchTypes';

const result = (id: string, matchKind: 'similarity' | 'relatedness') => ({
  chunkId: id,
  matchKind,
  memoId: id,
}) as NetworkSearchResult;

describe('ambient result counts', () => {
  it('현재 보이는 결과 한 건을 제외해 유사·관련 개수를 센다', () => {
    const visible = result('a', 'similarity');
    expect(getAdditionalSearchCounts(visible, [
      visible, result('b', 'similarity'), result('c', 'relatedness'),
    ])).toEqual({ similarity: 1, relatedness: 1 });
  });

  it('0건인 축을 표시하지 않고 둘 다 0건이면 배지를 숨긴다', () => {
    const visible = result('a', 'relatedness');
    expect(getAdditionalSearchCounts(visible, [visible, result('b', 'relatedness')]))
      .toEqual({ similarity: 0, relatedness: 1 });
    expect(getAdditionalSearchCounts(visible, [visible]))
      .toEqual({ similarity: 0, relatedness: 0 });
  });

  it('ghost 개수 버튼은 결과 열기 버튼과 분리되고 접근성 이름이 있다', () => {
    const source = readFileSync(resolve(__dirname,
      '../components/tiptap-templates/simple/simple-editor.tsx'), 'utf8');
    expect(source).toContain('wrapper.append(button)');
    expect(source).toContain('wrapper.append(more)');
    expect(source).toContain('more.setAttribute("aria-label", ghost.moreResults.ariaLabel)');
    expect(source).toContain('more.addEventListener("click", ghost.moreResults.onClick)');
  });
});
