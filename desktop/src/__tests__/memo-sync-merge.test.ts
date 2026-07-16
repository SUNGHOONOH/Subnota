import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UpsertMemoResult } from '../services/supabase/data';

const upsertMemo = vi.fn();
vi.mock('../services/supabase/data', () => ({
  upsertMemo: (...args: unknown[]) => upsertMemo(...args),
}));

import { pushMemoMerging } from '../services/supabase/memoSync';

const session = { user: { id: 'user-1' } } as never;
const BASE = '부산 여행 계획\n첫날은 광안리 산책\n둘째날은 돼지국밥';
const LOCAL = `${BASE}\n셋째날은 밀면`;
const SERVER = BASE.replace('광안리 산책', '광안리 숙소에 짐 풀기');

const row = (content: string, hash: string, status: string): UpsertMemoResult =>
  ({
    memo: {
      category: 'general',
      content,
      content_hash: hash,
      content_updated_at: '2026-07-06T00:00:00.000Z',
      created_at: '2026-07-01T00:00:00.000Z',
      id: 'm1',
      is_archived: false,
      synced_content_hash: hash,
      updated_at: '2026-07-06T00:00:00.000Z',
    },
    status,
  }) as UpsertMemoResult;

const input = {
  baseContent: BASE,
  baseHash: 'hBase',
  category: 'general',
  content: LOCAL,
  contentUpdatedAt: '2026-07-06T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  id: 'm1',
};

beforeEach(() => {
  upsertMemo.mockReset();
});

describe('pushMemoMerging (auto-merge first, conflict copy as fallback)', () => {
  it('passes non-conflict results through', async () => {
    upsertMemo.mockResolvedValueOnce(row(LOCAL, 'hLocal', 'updated'));

    const result = await pushMemoMerging(session, input);

    expect(result.status).toBe('synced');
    expect(result.merged).toBe(false);
    expect(upsertMemo).toHaveBeenCalledTimes(1);
  });

  it('on conflict, 3-way merges and re-pushes against the server hash', async () => {
    upsertMemo
      .mockResolvedValueOnce(row(SERVER, 'hServer', 'conflict'))
      .mockResolvedValueOnce(row('merged', 'hMerged', 'updated'));

    const result = await pushMemoMerging(session, input);

    expect(result.status).toBe('synced');
    expect(result.merged).toBe(true);
    const retryArgs = upsertMemo.mock.calls[1];
    expect(retryArgs[1].baseHash).toBe('hServer');
    expect(retryArgs[1].content).toContain('광안리 숙소에 짐 풀기'); // server edit kept
    expect(retryArgs[1].content).toContain('셋째날은 밀면'); // local edit kept
  });

  it('falls back to a server-side conflict copy when merging is impossible', async () => {
    const divergedServer = '서버에서 전부 다시 작성했습니다. 접점이 전혀 없는 내용입니다.';
    upsertMemo
      .mockResolvedValueOnce(row(divergedServer, 'hServer', 'conflict'))
      .mockResolvedValueOnce(row(divergedServer, 'hServer', 'conflict'));

    const result = await pushMemoMerging(session, {
      ...input,
      baseContent: BASE,
      content: '완전히 새로 쓴 로컬 메모입니다. 원본과 겹치는 부분이 없습니다.',
    });

    expect(result.status).toBe('conflict-copy');
    expect(result.memo?.content).toBe(divergedServer); // server stays canonical
    const fallbackArgs = upsertMemo.mock.calls[1];
    expect(fallbackArgs[2]).toEqual({ preserveConflictCopy: true });
  });

  it('falls back when no base content is available', async () => {
    upsertMemo
      .mockResolvedValueOnce(row(SERVER, 'hServer', 'conflict'))
      .mockResolvedValueOnce(row(SERVER, 'hServer', 'conflict'));

    const result = await pushMemoMerging(session, { ...input, baseContent: null });

    expect(result.status).toBe('conflict-copy');
    expect(upsertMemo.mock.calls[1][2]).toEqual({ preserveConflictCopy: true });
  });

  it('propagates tombstone deletes', async () => {
    upsertMemo.mockResolvedValueOnce({ memo: null, status: 'deleted' });

    const result = await pushMemoMerging(session, input);

    expect(result.status).toBe('deleted');
    expect(result.memo).toBeNull();
  });
});
