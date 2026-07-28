import { afterEach, describe, expect, it, vi } from 'vitest';

import { hashText } from '../lib/contentHash';
import {
  createLocalMemoIndexer,
  indexableChunksForMemo,
} from '../services/local/localMemoIndexer';
import { MemoRow } from '../types';

const makeMemo = (content: string, id = 'memo-1'): MemoRow => ({
  content,
  content_hash: hashText(content),
  created_at: '2026-07-25T00:00:00.000Z',
  id,
  is_archived: false,
  updated_at: '2026-07-25T00:00:00.000Z',
});

const createApi = () => {
  const states: Array<{
    chunkCount: number;
    memoId: string;
    sourceContentHash: string;
  }> = [];
  return {
    localDbMemoVectorState: vi.fn(async () => states),
    localDbMemoVectorTexts: vi.fn(async () => [] as string[]),
    localDbReplaceMemoVectors: vi.fn(async () => ({ stored: true })),
    localDbSetOwner: vi.fn(async () => undefined),
    localEmbedForIndex: vi.fn(async () => {
      const vector = new Array<number>(1024).fill(0);
      vector[0] = 1;
      return [vector];
    }),
    localEmbedReleaseIndexModel: vi.fn(async () => undefined),
    localEmbedStatus: vi.fn(async () => ({
      downloadedBytes: 586_779_294,
      state: 'ready' as const,
      totalBytes: 586_779_294,
    })),
    states,
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('local memo indexer', () => {
  it('구분선 같은 noise를 제외하고 각 청크를 한 건씩 임베딩한다', async () => {
    const api = createApi();
    const indexer = createLocalMemoIndexer({ api });
    const memo = makeMemo(
      '첫 번째로 색인할 문장입니다.\n─────────────\n두 번째로 색인할 문장입니다.',
    );

    await indexer.reconcile([memo], null);

    expect(api.localEmbedForIndex.mock.calls).toEqual(
      indexableChunksForMemo(memo).map(chunk => [[chunk.text]]),
    );
    expect(api.localDbReplaceMemoVectors).toHaveBeenCalledOnce();
    const storedChunks = api.localDbReplaceMemoVectors.mock.calls[0]?.[4];
    expect(storedChunks).toHaveLength(2);
    expect(storedChunks?.every(chunk => chunk.vector.length === 1024)).toBe(true);
    expect(api.localDbSetOwner).toHaveBeenCalledWith(null);
    expect(api.localEmbedReleaseIndexModel).toHaveBeenCalledOnce();
  });

  it('내용 hash가 같은 메모는 다시 임베딩하지 않는다', async () => {
    const api = createApi();
    const memo = makeMemo('이미 색인된 문장입니다.');
    api.states.push({
      chunkCount: 1,
      memoId: memo.id,
      sourceContentHash: String(memo.content_hash),
    });
    const indexer = createLocalMemoIndexer({ api });

    await indexer.reconcile([memo], 'owner-1');

    expect(api.localEmbedForIndex).not.toHaveBeenCalled();
    expect(api.localDbReplaceMemoVectors).not.toHaveBeenCalled();
  });

  it('위치가 달라져도 텍스트가 같은 청크 벡터는 재사용한다', async () => {
    const api = createApi();
    const memo = makeMemo(
      '그대로인 첫 문장입니다.\n새로 바뀐 둘째 문장입니다.',
    );
    api.localDbMemoVectorTexts.mockResolvedValueOnce([
      '그대로인 첫 문장입니다.',
    ]);
    const indexer = createLocalMemoIndexer({ api });

    await indexer.reconcile([memo], null);

    expect(api.localEmbedForIndex.mock.calls).toEqual([
      [['새로 바뀐 둘째 문장입니다.']],
    ]);
    const storedChunks = api.localDbReplaceMemoVectors.mock.calls[0]?.[4];
    expect(storedChunks?.map(chunk => chunk.vector)).toEqual([
      null,
      expect.arrayContaining([1]),
    ]);
  });

  it('첫 전체 색인의 진행률을 meaningful 청크 수로 보고한다', async () => {
    const api = createApi();
    const indexer = createLocalMemoIndexer({ api });
    const progress = vi.fn();
    indexer.subscribe(progress);
    const memos = [
      makeMemo('첫 메모의 문장입니다.', 'memo-1'),
      makeMemo('둘째 메모의 첫 문장입니다.\n둘째 메모의 다음 문장입니다.', 'memo-2'),
    ];

    await indexer.reconcile(memos, 'owner-1');

    const complete = progress.mock.calls
      .map(call => call[0])
      .find(item => item.stage === 'complete');
    expect(complete).toMatchObject({
      completedChunks: 3,
      ownerId: 'owner-1',
      totalChunks: 3,
    });
  });

  it('색인 중 변경되어 저장이 거절된 snapshot을 완료로 보고하지 않는다', async () => {
    const api = createApi();
    api.localDbReplaceMemoVectors.mockResolvedValueOnce({ stored: false });
    const indexer = createLocalMemoIndexer({ api });
    const progress = vi.fn();
    indexer.subscribe(progress);

    await indexer.reconcile([makeMemo('색인 도중 수정될 문장입니다.')], null);

    const events = progress.mock.calls.map(call => call[0]);
    expect(
      events.some(
        item => item.stage === 'complete' && item.totalChunks > 0,
      ),
    ).toBe(false);
    expect(events.at(-1)).toMatchObject({
      completedChunks: 1,
      stage: 'failed',
      totalChunks: 1,
    });
  });

  it('증분 색인은 debounce 뒤 마지막 revision만 처리한다', async () => {
    vi.useFakeTimers();
    const api = createApi();
    const indexer = createLocalMemoIndexer({ api, debounceMs: 50 });
    const first = makeMemo('처음 저장한 내용입니다.');
    const latest = makeMemo('마지막으로 저장한 최신 내용입니다.');

    indexer.scheduleMemo(first, null);
    indexer.scheduleMemo(latest, null);
    await vi.advanceTimersByTimeAsync(50);
    // Timer가 enqueue한 작업 뒤에 빈 reconcile을 붙여 완료를 기다린다.
    await indexer.reconcile([], null);

    expect(api.localDbReplaceMemoVectors).toHaveBeenCalledOnce();
    expect(api.localDbReplaceMemoVectors.mock.calls[0]?.[3]).toBe(
      latest.content,
    );
  });
});
