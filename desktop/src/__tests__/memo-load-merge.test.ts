import { describe, expect, it } from 'vitest';

import {
  mergeLoadedMemosPreservingLocalWrites,
  partitionRemoteMemoConflictCopies,
  pendingMemoIdsForOwner,
  shouldDeferMemoSync,
} from '../lib/memoLoadMerge';
import type { MemoRow } from '../types';

const memo = (
  id: string,
  content: string,
  updatedAt: string,
): MemoRow => ({
  category: 'general',
  content,
  content_hash: `hash:${content}`,
  created_at: '2026-07-01T00:00:00.000Z',
  id,
  is_archived: false,
  updated_at: updatedAt,
});

describe('workspace memo snapshot merge', () => {
  it('never lets an older loaded snapshot replace a local write in progress', () => {
    const current = memo(
      'memo-1',
      '방금 입력한 최신 문장',
      '2026-07-30T05:00:01.000Z',
    );
    const loaded = memo(
      'memo-1',
      'SQLite 또는 서버의 과거 문장',
      '2026-07-30T05:00:00.000Z',
    );

    const merged = mergeLoadedMemosPreservingLocalWrites(
      [loaded],
      [current],
      new Set(['memo-1']),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe('방금 입력한 최신 문장');
  });

  it('keeps a new local memo that was absent from the loaded snapshot without duplicating it', () => {
    const current = memo(
      'memo-new',
      '새 메모',
      '2026-07-30T05:00:01.000Z',
    );

    const merged = mergeLoadedMemosPreservingLocalWrites(
      [],
      [current],
      new Set(['memo-new']),
    );

    expect(merged.map(item => item.id)).toEqual(['memo-new']);
  });

  it('accepts loaded data for memos without a local write in progress', () => {
    const current = memo('memo-1', '이전 화면 값', '2026-07-30T05:00:00.000Z');
    const loaded = memo('memo-1', '다른 기기의 최신 값', '2026-07-30T05:00:02.000Z');

    const merged = mergeLoadedMemosPreservingLocalWrites(
      [loaded],
      [current],
      new Set(),
    );

    expect(merged[0].content).toBe('다른 기기의 최신 값');
  });

  it('does not replace the document snapshot of a memo that is open in an editor', () => {
    const current = memo(
      'memo-1',
      '현재 에디터가 소유한 문장',
      '2026-07-30T05:00:00.000Z',
    );
    const loaded = memo(
      'memo-1',
      '다른 기기에서 바뀐 문장',
      '2026-07-30T05:00:02.000Z',
    );

    const merged = mergeLoadedMemosPreservingLocalWrites(
      [loaded],
      [current],
      new Set(),
      new Set(['memo-1']),
    );

    expect(merged[0].content).toBe('현재 에디터가 소유한 문장');
  });

  it('isolates pending writes by account and defers both write and sync queues', () => {
    const pendingOwners = new Map([
      ['memo-a', 'owner-a'],
      ['memo-b', 'owner-b'],
    ]);
    const ownerAIds = pendingMemoIdsForOwner(pendingOwners, 'owner-a');

    expect([...ownerAIds]).toEqual(['memo-a']);
    expect(shouldDeferMemoSync('memo-a', ownerAIds, new Map())).toBe(true);
    expect(
      shouldDeferMemoSync(
        'memo-b',
        ownerAIds,
        new Map([['memo-b', 1]]),
      ),
    ).toBe(true);
    expect(shouldDeferMemoSync('memo-c', ownerAIds, new Map())).toBe(false);
  });

  it('removes server conflict copies from the visible list without discarding them', () => {
    const original = memo('memo-1', '현재 메모', '2026-07-30T05:00:02.000Z');
    const copy = {
      ...memo('copy-1', '내부 복구할 문장', '2026-07-30T05:00:01.000Z'),
      conflict_of: 'memo-1',
    };

    const partitioned = partitionRemoteMemoConflictCopies([original, copy]);

    expect(partitioned.visibleMemos.map(item => item.id)).toEqual(['memo-1']);
    expect(partitioned.conflictCopies.map(item => item.id)).toEqual(['copy-1']);
  });
});
