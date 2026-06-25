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

describe('memo search index', () => {
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
