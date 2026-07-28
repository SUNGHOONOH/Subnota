import { hashText } from '../../lib/contentHash';
import { isMeaningfulChunk } from '../../lib/memoChunker';
import type { MemoChunk } from '../../lib/memoChunker';
import type {
  NetworkSearchResponse,
  NetworkSearchResult,
} from '../backend/networkService';

interface LocalMemoSearchRow {
  chunkId: string;
  chunkText: string;
  endIndex: number;
  memoContent: string;
  memoCreatedAt: string | null;
  memoId: string;
  memoUpdatedAt: string | null;
  similarity: number;
  startIndex: number;
}

interface LocalInboxSearchRow {
  chunkId: string;
  chunkText: string;
  createdAt: string | null;
  inboxSessionId: string;
  similarity: number;
  sourceLabel: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  title: string | null;
}

interface LocalMemoSearchApi {
  localDbSearchMemoVectors: (
    ownerId: string | null,
    queryVector: number[],
    excludeMemoId: string | null,
    limit: number,
    minimumSimilarity: number,
  ) => Promise<LocalMemoSearchRow[]>;
  localDbSearchInboxVectors: (
    ownerId: string | null,
    queryVector: number[],
    limit: number,
    minimumSimilarity: number,
  ) => Promise<LocalInboxSearchRow[]>;
  localDbSetOwner: (ownerId: string | null) => Promise<void>;
  localEmbed: (texts: string[]) => Promise<number[][]>;
}

export const LOCAL_SEARCH_EMPTY_MESSAGE = '비슷한 문장이 아직은 없네요!';
export const LOCAL_SEARCH_ERROR_MESSAGE =
  '로컬 검색을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const NEAR_DUPLICATE_SIMILARITY = 0.97;

export const formatLocalMemoSearchErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return null;
  return LOCAL_SEARCH_ERROR_MESSAGE;
};

const getApi = (): LocalMemoSearchApi => {
  if (!window.electronAPI?.localDbSearchMemoVectors) {
    throw new Error('Local memo search bridge is unavailable.');
  }
  return window.electronAPI;
};

export const searchLocalMemoChunks = async ({
  api = getApi(),
  limit = 1,
  memoId,
  minimumSimilarity,
  ownerId,
  queryText,
}: {
  api?: LocalMemoSearchApi;
  limit?: number;
  memoId: string | null;
  minimumSimilarity: number;
  ownerId: string | null;
  queryText: string;
}): Promise<NetworkSearchResponse> => {
  const text = queryText.trim().slice(0, 1000);
  if (!text || !isMeaningfulChunk(text)) {
    return {
      message: LOCAL_SEARCH_EMPTY_MESSAGE,
      queryChunk: null,
      results: [],
    };
  }

  const queryChunk: MemoChunk = {
    end: text.length,
    id: `local-query-${hashText(text)}`,
    index: 0,
    start: 0,
    text,
  };
  await api.localDbSetOwner(ownerId);
  // 질의는 대화형 extractor를 사용한다. 배경 색인용 2-thread 세션과
  // 구현체·모델·양자화는 같고, latency를 위해 스레드 제한만 적용하지 않는다.
  const [queryVector] = await api.localEmbed([text]);
  const candidateLimit = Math.min(10, Math.max(limit * 2, 5));
  const [memoRows, inboxRows] = await Promise.all([
    api.localDbSearchMemoVectors(
      ownerId,
      queryVector,
      memoId,
      candidateLimit,
      minimumSimilarity,
    ),
    api.localDbSearchInboxVectors(
      ownerId,
      queryVector,
      candidateLimit,
      minimumSimilarity,
    ),
  ]);
  const memoResults: NetworkSearchResult[] = memoRows
    .filter(
      row =>
        row.similarity <= NEAR_DUPLICATE_SIMILARITY &&
        row.chunkText.trim() !== text,
    )
    .map(row => ({
      chunkId: row.chunkId,
      chunkText: row.chunkText,
      createdAt: null,
      endIndex: row.endIndex,
      inboxSessionId: null,
      memoContent: row.memoContent,
      memoCreatedAt: row.memoCreatedAt
        ? new Date(row.memoCreatedAt).getTime()
        : null,
      memoId: row.memoId,
      memoUpdatedAt: row.memoUpdatedAt
        ? new Date(row.memoUpdatedAt).getTime()
        : null,
      similarity: row.similarity,
      sourceKind: 'memo',
      sourceLabel: null,
      sourceType: null,
      sourceUrl: null,
      startIndex: row.startIndex,
      thumbnailUrl: null,
      title: null,
    }));
  const inboxResults: NetworkSearchResult[] = inboxRows
    .filter(
      row =>
        row.similarity <= NEAR_DUPLICATE_SIMILARITY &&
        row.chunkText.trim() !== text,
    )
    .map(row => ({
      chunkId: row.chunkId,
      chunkText: row.chunkText,
      createdAt: row.createdAt ? new Date(row.createdAt).getTime() : null,
      endIndex: row.chunkText.length,
      inboxSessionId: row.inboxSessionId,
      memoContent: null,
      memoCreatedAt: null,
      memoId: null,
      memoUpdatedAt: null,
      similarity: row.similarity,
      sourceKind: 'inbox',
      sourceLabel: row.sourceLabel,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      startIndex: 0,
      thumbnailUrl: row.thumbnailUrl,
      title: row.title,
    }));
  const results = [...memoResults, ...inboxResults]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);

  return {
    message: results.length === 0 ? LOCAL_SEARCH_EMPTY_MESSAGE : null,
    queryChunk,
    results,
  };
};
