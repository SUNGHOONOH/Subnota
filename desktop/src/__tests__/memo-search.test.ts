import { describe, expect, it } from 'vitest';

import { buildMemoSearchIndex, syncMemoSearchIndex } from '../lib/memoSearch';
import type { MemoRow } from '../types';

const makeMemo = (overrides: Partial<MemoRow>): MemoRow =>
  ({
    category: 'Ideas',
    content: '',
    created_at: '2026-01-01T00:00:00.000Z',
    id: 'memo-1',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as MemoRow;

describe('buildMemoSearchIndex', () => {
  // Regression: a custom extractField also feeds MiniSearch's idField, so memos
  // with identical content used to collide on id and throw inside addAll,
  // crashing the workspace into a blank screen.
  it('indexes memos with identical content without throwing', () => {
    const memos = [
      makeMemo({ id: 'a', content: '같은 내용' }),
      makeMemo({ id: 'b', content: '같은 내용' }),
    ];

    expect(() => buildMemoSearchIndex(memos)).not.toThrow();
  });

  it('returns distinct memo ids for a query match', () => {
    const memos = [
      makeMemo({ id: 'a', content: '프로젝트 회의 노트' }),
      makeMemo({ id: 'b', content: '저녁 장보기 목록' }),
    ];

    const index = buildMemoSearchIndex(memos);
    const ids = index.search('회의', { prefix: true }).map(result => result.id);

    expect(ids).toEqual(['a']);
  });

  it('replaces only changed documents in an existing index', () => {
    const index = buildMemoSearchIndex([]);
    const versions = new Map<string, string>();
    syncMemoSearchIndex(index, versions, [
      makeMemo({ id: 'a', content: '기존 검색어', content_hash: 'old' }),
      makeMemo({ id: 'b', content: '유지되는 메모', content_hash: 'same' }),
    ]);
    syncMemoSearchIndex(index, versions, [
      makeMemo({ id: 'a', content: '새 검색어', content_hash: 'new' }),
      makeMemo({ id: 'b', content: '유지되는 메모', content_hash: 'same' }),
    ]);

    expect(index.search('기존')).toEqual([]);
    expect(index.search('새').map(result => result.id)).toEqual(['a']);
  });
});
