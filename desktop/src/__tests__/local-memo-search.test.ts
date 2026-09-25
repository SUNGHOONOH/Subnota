import { describe, expect, it, vi } from 'vitest';

import {
  LOCAL_SEARCH_ERROR_MESSAGE,
  formatLocalMemoSearchErrorMessage,
  searchLocalMemoChunks,
  searchNearbyMemos,
} from '../services/local/localMemoSearch';

const queryVector = Array.from({ length: 1024 }, (_, index) =>
  index === 0 ? 1 : 0,
);

const searchRow = (
  patch: Partial<{
    chunkId: string;
    chunkText: string;
    memoId: string;
    similarity: number;
  }> = {},
) => ({
  chunkId: 'chunk-2',
  chunkText: '연결된 로컬 문장',
  endIndex: 18,
  memoContent: '연결된 로컬 문장이 들어 있는 메모',
  memoCreatedAt: '2026-07-20T00:00:00.000Z',
  memoId: 'memo-2',
  memoUpdatedAt: '2026-07-25T00:00:00.000Z',
  similarity: 0.83,
  startIndex: 2,
  ...patch,
});

const createApi = () => ({
  localDbSearchInboxVectors: vi.fn(async () => []),
  localDbSearchMemoVectors: vi.fn(async () => [searchRow()]),
  localDbSearchTopicMemoVectors: vi.fn(async () => [] as ReturnType<typeof searchRow>[]),
  localDbSearchSimilarMemos: vi.fn(async () => ({
    inbox: [],
    memos: [searchRow({ similarity: 0.31 })],
  })),
  localDbSetOwner: vi.fn(async () => undefined),
  localEmbed: vi.fn(async () => [queryVector]),
});

describe('local memo search', () => {
  it('수동 목록만 유사성 5칸 뒤에 중복 없는 연관성 3칸을 붙이고 부족하면 유사성으로 채운다', async () => {
    const api = createApi();
    api.localDbSearchMemoVectors.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => searchRow({
        chunkId: `chunk-${index}`,
        memoId: `memo-${index}`,
        similarity: 1 - index / 10,
      })),
    );
    api.localDbSearchTopicMemoVectors.mockResolvedValue([
      searchRow({ chunkId: 'related-duplicate', memoId: 'memo-1', similarity: 1.4 }),
      searchRow({ chunkId: 'related-new', memoId: 'memo-9', similarity: -0.3 }),
    ]);
    const response = await searchLocalMemoChunks({
      api, includeRelatedness: true, limit: 8, memoId: null,
      minimumSimilarity: -2, ownerId: null, queryText: '수동 검색 문장입니다.',
    });
    expect(response.results.map(result => [result.memoId, result.matchKind])).toEqual([
      ['memo-0', 'similarity'], ['memo-1', 'similarity'],
      ['memo-2', 'similarity'], ['memo-3', 'similarity'],
      ['memo-4', 'similarity'], ['memo-9', 'relatedness'],
      ['memo-5', 'similarity'], ['memo-6', 'similarity'],
    ]);
    expect(api.localEmbed).toHaveBeenCalledTimes(1);
  });

  it('자동 단건 검색은 연관 경로를 호출하지 않는다', async () => {
    const api = createApi();
    const response = await searchLocalMemoChunks({
      api, memoId: null, minimumSimilarity: 0.1,
      ownerId: null, queryText: '자동 검색 문장입니다.',
    });
    expect(response.results).toHaveLength(1);
    expect(response.results[0].matchKind).toBe('similarity');
    expect(api.localDbSearchTopicMemoVectors).not.toHaveBeenCalled();
  });

  it('연관 인덱스 오류가 있어도 수동 검색은 유사 결과를 보여준다', async () => {
    const api = createApi();
    api.localDbSearchTopicMemoVectors.mockRejectedValue(new Error('topic index unavailable'));
    const response = await searchLocalMemoChunks({
      api, includeRelatedness: true, limit: 8, memoId: null,
      minimumSimilarity: -2, ownerId: null, queryText: '수동 검색 문장입니다.',
    });
    expect(response.results.map(result => result.matchKind)).toEqual(['similarity']);
  });
  it('대화형 단건 임베딩으로 현재 메모를 제외해 로컬 벡터를 검색한다', async () => {
    const api = createApi();
    const response = await searchLocalMemoChunks({
      api,
      limit: 1,
      memoId: 'memo-1',
      minimumSimilarity: 0.75,
      ownerId: null,
      queryText: '  현재 작성 중인 검색 문장입니다.  ',
    });

    expect(api.localEmbed).toHaveBeenCalledWith([
      '현재 작성 중인 검색 문장입니다.',
    ]);
    expect(api.localDbSearchMemoVectors).toHaveBeenCalledWith(
      null,
      queryVector,
      'memo-1',
      5,
      0.75,
    );
    expect(api.localDbSearchInboxVectors).toHaveBeenCalledWith(
      null,
      queryVector,
      5,
      0.75,
    );
    expect(response.results[0]).toMatchObject({
      chunkId: 'chunk-2',
      memoId: 'memo-2',
      similarity: 0.83,
      sourceKind: 'memo',
    });
    expect(response.queryChunk?.text).toBe('현재 작성 중인 검색 문장입니다.');
  });

  it('다른 메모와 Inbox의 같은·근사 문장도 결과로 남긴다', async () => {
    const api = createApi();
    api.localDbSearchMemoVectors.mockResolvedValueOnce([
      searchRow({
        chunkId: 'chunk-near',
        chunkText: '표현만 거의 같은 문장',
        similarity: 0.970001,
      }),
      searchRow({
        chunkId: 'chunk-exact',
        chunkText: '현재 검색 문장',
        similarity: 0.9,
      }),
    ]);
    api.localDbSearchInboxVectors.mockResolvedValueOnce([
      {
        chunkId: 'inbox-inbox-1',
        chunkText: '현재 검색 문장',
        createdAt: '2026-07-26T00:00:00.000Z',
        inboxSessionId: 'inbox-1',
        similarity: 0.98,
        sourceLabel: 'example.com',
        sourceType: 'url',
        sourceUrl: 'https://example.com',
        thumbnailUrl: null,
        title: '관련 링크',
      },
    ]);

    const response = await searchLocalMemoChunks({
      api,
      limit: 3,
      memoId: 'memo-1',
      minimumSimilarity: 0.75,
      ownerId: null,
      queryText: '현재 검색 문장',
    });

    expect(response.results.map(result => result.chunkId)).toEqual([
      'inbox-inbox-1',
      'chunk-near',
      'chunk-exact',
    ]);
    expect(response.message).toBeNull();
  });

  it('메모 청크와 Inbox 벡터를 한 순위로 합친다', async () => {
    const api = createApi();
    api.localDbSearchInboxVectors.mockResolvedValueOnce([
      {
        chunkId: 'inbox-inbox-1',
        chunkText: '관련 링크 요약',
        createdAt: '2026-07-26T00:00:00.000Z',
        inboxSessionId: 'inbox-1',
        similarity: 0.91,
        sourceLabel: 'example.com',
        sourceType: 'url',
        sourceUrl: 'https://example.com',
        thumbnailUrl: null,
        title: '관련 링크',
      },
    ]);

    const response = await searchLocalMemoChunks({
      api,
      limit: 2,
      memoId: 'memo-1',
      minimumSimilarity: 0.75,
      ownerId: null,
      queryText: '현재 검색 문장',
    });

    expect(response.results.map(result => result.sourceKind)).toEqual([
      'inbox',
      'memo',
    ]);
    expect(response.results[0]).toMatchObject({
      inboxSessionId: 'inbox-1',
      sourceUrl: 'https://example.com',
      title: '관련 링크',
    });
  });

  it('무의미한 질의는 모델을 로드하지 않는다', async () => {
    const api = createApi();
    const response = await searchLocalMemoChunks({
      api,
      memoId: null,
      minimumSimilarity: 0.75,
      ownerId: null,
      queryText: '────────────',
    });

    expect(response.results).toEqual([]);
    expect(api.localEmbed).not.toHaveBeenCalled();
    expect(api.localDbSearchMemoVectors).not.toHaveBeenCalled();
    expect(api.localDbSearchInboxVectors).not.toHaveBeenCalled();
  });

  it('임베딩 중 취소되면 이전 커서 위치의 DB 검색을 이어가지 않는다', async () => {
    const api = createApi();
    const controller = new AbortController();
    api.localEmbed.mockImplementationOnce(async () => {
      controller.abort();
      return [queryVector];
    });

    await expect(
      searchLocalMemoChunks({
        api,
        memoId: 'memo-1',
        minimumSimilarity: 0.75,
        ownerId: null,
        queryText: '취소할 이전 커서 위치의 문장입니다.',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(api.localDbSearchMemoVectors).not.toHaveBeenCalled();
    expect(api.localDbSearchInboxVectors).not.toHaveBeenCalled();
  });

  it('로컬 실패 메시지는 네트워크 연결을 요구하지 않는다', () => {
    expect(formatLocalMemoSearchErrorMessage(new Error('load failed'))).toBe(
      LOCAL_SEARCH_ERROR_MESSAGE,
    );
    expect(LOCAL_SEARCH_ERROR_MESSAGE).not.toContain('네트워크');
    expect(
      formatLocalMemoSearchErrorMessage(
        new DOMException('workspace changed', 'AbortError'),
      ),
    ).toBeNull();
  });

  it('주변 메모는 메모의 모든 문장을 임베딩해 메모 단위로 검색한다', async () => {
    const api = createApi();
    api.localEmbed.mockResolvedValueOnce([queryVector, queryVector]);
    const response = await searchNearbyMemos({
      api,
      limit: 8,
      memoId: 'memo-1',
      minimumSimilarity: 0.1,
      ownerId: null,
      queryText: '배당주 공부를 시작했다. 매달 현금흐름을 기록해 본다.',
    });

    expect(api.localEmbed).toHaveBeenCalledWith([
      '배당주 공부를 시작했다.',
      '매달 현금흐름을 기록해 본다.',
    ]);
    expect(api.localDbSearchSimilarMemos).toHaveBeenCalledWith(
      null,
      [queryVector, queryVector],
      'memo-1',
      8,
      0.1,
    );
    expect(api.localDbSearchMemoVectors).not.toHaveBeenCalled();
    expect(response.results).toMatchObject([
      { memoId: 'memo-2', similarity: 0.31, sourceKind: 'memo' },
    ]);
    expect(response.queryChunk?.text).toBe(
      '배당주 공부를 시작했다. 매달 현금흐름을 기록해 본다.',
    );
  });

  it('의미 있는 문장이 없으면 모델을 깨우지 않는다', async () => {
    const api = createApi();
    const response = await searchNearbyMemos({
      api,
      limit: 8,
      memoId: null,
      minimumSimilarity: 0.1,
      ownerId: null,
      queryText: '   ',
    });
    expect(api.localEmbed).not.toHaveBeenCalled();
    expect(response.queryChunk).toBeNull();
  });
});
