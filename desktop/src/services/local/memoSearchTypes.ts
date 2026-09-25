import type { MemoChunk } from '../../lib/memoChunker';

export interface NetworkSearchResult {
  chunkId: string;
  chunkText: string;
  createdAt: number | null;
  endIndex: number;
  inboxSessionId: string | null;
  memoContent: string | null;
  memoCreatedAt: number | null;
  memoId: string | null;
  memoUpdatedAt: number | null;
  similarity: number;
  sourceKind: 'memo' | 'inbox';
  sourceLabel: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  startIndex: number;
  thumbnailUrl: string | null;
  title: string | null;
}

export interface NetworkSearchResponse {
  message?: string | null;
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
}

export const NETWORK_SEARCH_EMPTY_MESSAGE =
  '연결된 메모나 저장한 링크가 아직은 없네요!';
export const NETWORK_SEARCH_RETRY_MESSAGE =
  '주변 메모를 찾지 못했습니다. 다시 시도해 주세요.';

export const isNetworkSearchRetryableMessage = (message?: string | null) =>
  Boolean(
    message &&
      (message === NETWORK_SEARCH_RETRY_MESSAGE ||
        message.includes('초 후 다시 시도')),
  );
