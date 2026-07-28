import { describe, expect, it, vi } from 'vitest';

import {
  LOCAL_SEARCH_ERROR_MESSAGE,
  formatLocalMemoSearchErrorMessage,
  searchLocalMemoChunks,
} from '../services/local/localMemoSearch';

const queryVector = Array.from({ length: 1024 }, (_, index) =>
  index === 0 ? 1 : 0,
);

const searchRow = (
  patch: Partial<{
    chunkText: string;
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
  localDbSetOwner: vi.fn(async () => undefined),
  localEmbed: vi.fn(async () => [queryVector]),
});

describe('local memo search', () => {
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

  it('0.97을 넘는 근사 중복과 완전히 같은 텍스트를 제외한다', async () => {
    const api = createApi();
    api.localDbSearchMemoVectors.mockResolvedValueOnce([
      searchRow({ chunkText: '표현만 거의 같은 문장', similarity: 0.970001 }),
      searchRow({ chunkText: '현재 검색 문장', similarity: 0.9 }),
    ]);

    const response = await searchLocalMemoChunks({
      api,
      limit: 2,
      memoId: 'memo-1',
      minimumSimilarity: 0.75,
      ownerId: null,
      queryText: '현재 검색 문장',
    });

    expect(response.results).toEqual([]);
    expect(response.message).toBeTruthy();
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
});
