import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COLLAPSED_SECTIONS_KEY,
  getFolderMemoRows,
  getMemoPreview,
  getMemoTitle,
  readCollapsedSections,
} from '../features/memo/memoWorkspaceUtils';
import type { MemoFolderMembership, MemoRow } from '../types';

const memo = (id: string, content: string, updated_at: string): MemoRow => ({
  content,
  content_hash: null,
  created_at: updated_at,
  id,
  is_archived: false,
  updated_at,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('memo workspace presentation helpers', () => {
  it('uses the first non-empty line as the title and second line as preview', () => {
    const row = memo('memo-1', '\n  제목입니다  \n 본문 미리보기 ', '2026-09-01');

    expect(getMemoTitle(row, 'ko')).toBe('제목입니다');
    expect(getMemoPreview(row, 'ko')).toBe('본문 미리보기');
  });

  it('falls back to localized labels for empty content', () => {
    const row = memo('memo-1', '\n\n', '2026-09-01');

    expect(getMemoTitle(row, 'ko')).toBe('새 메모');
    expect(getMemoPreview(row, 'en')).toBe('No content');
  });

  it('joins existing folder memberships to memos and sorts newest first', () => {
    const rows = [
      memo('older', 'Older', '2026-09-01T09:00:00.000Z'),
      memo('newer', 'Newer', '2026-09-02T09:00:00.000Z'),
    ];
    const memberships: MemoFolderMembership[] = [
      {
        createdAt: '2026-09-01',
        folderId: 'folder-a',
        memoId: 'older',
        score: null,
        source: 'user',
      },
      {
        createdAt: '2026-09-02',
        folderId: 'folder-a',
        memoId: 'newer',
        score: 0.9,
        source: 'automatic',
      },
      {
        createdAt: '2026-09-03',
        folderId: 'folder-b',
        memoId: 'newer',
        score: null,
        source: 'user',
      },
    ];

    expect(
      getFolderMemoRows({
        folderId: 'folder-a',
        memberships,
        memos: rows,
      }).map(({ memo: item }) => item.id),
    ).toEqual(['newer', 'older']);
  });

  it('restores only string section keys from local storage', () => {
    const getItem = vi.fn().mockReturnValue(
      JSON.stringify(['목록', 42, null, '폴더']),
    );
    vi.stubGlobal('window', { localStorage: { getItem } });

    expect(Array.from(readCollapsedSections())).toEqual(['목록', '폴더']);
    expect(getItem).toHaveBeenCalledWith(COLLAPSED_SECTIONS_KEY);
  });
});
