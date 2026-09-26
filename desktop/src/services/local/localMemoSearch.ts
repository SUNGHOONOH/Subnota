import { hashText } from '../../lib/contentHash';
import { hasSearchableContent, normalizeChunkText } from '../../lib/chunkText';
import { chunkMemoText, isMeaningfulChunk } from '../../lib/memoChunker';
import type { MemoChunk } from '../../lib/memoChunker';
import { AMBIENT_MIN_SIMILARITY } from '../../lib/constants';
import type {
  NetworkSearchResponse,
  NetworkSearchResult,
} from './memoSearchTypes';

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
  localDbSearchTopicMemoVectors?: (
    ownerId: string | null,
    queryVector: number[],
    excludeMemoId: string | null,
    limit: number,
  ) => Promise<LocalMemoSearchRow[]>;
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
  localDbSearchSimilarMemos: (
    ownerId: string | null,
    queryVectors: number[][],
    excludeMemoId: string | null,
    limit: number,
    minimumSimilarity: number,
  ) => Promise<{ inbox: LocalInboxSearchRow[]; memos: LocalMemoSearchRow[] }>;
  localDbSetOwner: (ownerId: string | null) => Promise<void>;
  localEmbed: (texts: string[]) => Promise<number[][]>;
}

export const LOCAL_SEARCH_EMPTY_MESSAGE = '비슷한 문장이 아직은 없네요!';
// 원인 문구는 두지 않는다 — 사용자가 할 수 있는 건 다시 시도뿐이고,
// "로컬"은 내부 용어라 아무것도 설명하지 못한다.
export const LOCAL_SEARCH_ERROR_MESSAGE = '검색하지 못했어요';

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException('Local memo search cancelled.', 'AbortError');
  }
};

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

const toMemoResult = (row: LocalMemoSearchRow, matchKind: NetworkSearchResult['matchKind'] = 'similarity'): NetworkSearchResult => ({
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
  matchKind,
  sourceKind: 'memo',
  sourceLabel: null,
  sourceType: null,
  sourceUrl: null,
  startIndex: row.startIndex,
  thumbnailUrl: null,
  title: null,
});

const toInboxResult = (row: LocalInboxSearchRow): NetworkSearchResult => ({
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
  matchKind: 'similarity',
  sourceKind: 'inbox',
  sourceLabel: row.sourceLabel,
  sourceType: row.sourceType,
  sourceUrl: row.sourceUrl,
  startIndex: 0,
  thumbnailUrl: row.thumbnailUrl,
  title: row.title,
});

export const mergeManualSearchResults = (
  similarity: NetworkSearchResult[],
  relatedness: NetworkSearchResult[],
  limit: number,
): NetworkSearchResult[] => {
  const first = similarity
    .filter(result => result.similarity >= AMBIENT_MIN_SIMILARITY)
    .slice(0, Math.min(5, limit));
  const seen = new Set(first.map(result => result.memoId ?? result.inboxSessionId));
  const related: NetworkSearchResult[] = [];
  for (const result of relatedness) {
    if (related.length >= Math.min(3, limit - first.length)) break;
    if (seen.has(result.memoId)) continue;
    related.push(result);
    seen.add(result.memoId);
  }
  return [...first, ...related];
};

export const searchLocalMemoChunks = async ({
  api = getApi(),
  limit = 1,
  memoId,
  minimumSimilarity,
  ownerId,
  queryText,
  signal,
  includeRelatedness = false,
}: {
  api?: LocalMemoSearchApi;
  limit?: number;
  memoId: string | null;
  minimumSimilarity: number;
  ownerId: string | null;
  queryText: string;
  signal?: AbortSignal;
  includeRelatedness?: boolean;
}): Promise<NetworkSearchResponse> => {
  throwIfAborted(signal);
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
  throwIfAborted(signal);
  // 질의는 대화형 extractor를 사용한다. 배경 색인용 2-thread 세션과
  // 구현체·모델·양자화는 같고, latency를 위해 스레드 제한만 적용하지 않는다.
  //
  // 색인이 정규화된 본문을 임베딩하므로 질의도 같은 규칙을 통과해야 한다.
  // 한쪽만 정규화하면 마크업이 섞인 만큼 벡터가 어긋난다. `queryChunk.text`는
  // 원문 그대로 둔다 — 편집기에서 문장 위치를 찾는 기준이다.
  const [queryVector] = await api.localEmbed([normalizeChunkText(text)]);
  throwIfAborted(signal);
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
  throwIfAborted(signal);
  const memoResults = memoRows.map(row => toMemoResult(row));
  const inboxResults = inboxRows.map(toInboxResult);
  const similarity = [...memoResults, ...inboxResults]
    .sort((left, right) => right.similarity - left.similarity);
  let results = includeRelatedness
    ? mergeManualSearchResults(similarity, [], limit)
    : similarity.slice(0, limit);
  if (includeRelatedness && api.localDbSearchTopicMemoVectors) {
    try {
      const relatedRows = await api.localDbSearchTopicMemoVectors(ownerId, queryVector, memoId, candidateLimit);
      throwIfAborted(signal);
      results = mergeManualSearchResults(
        similarity,
        relatedRows.map(row => toMemoResult(row, 'relatedness')),
        limit,
      );
    } catch {
      throwIfAborted(signal);
      // 주제어 인덱스가 없어도 같은 문턱과 최대 5건의 유사 결과를 유지한다.
    }
  }

  return {
    message: results.length === 0 ? LOCAL_SEARCH_EMPTY_MESSAGE : null,
    queryChunk,
    results,
  };
};

// ponytail: 아주 긴 메모는 앞 64개 청크만 질의에 쓴다. 전체를 쓰려면 저장된
// 청크 벡터를 재사용하는 경로가 필요하다.
const NEARBY_MAX_QUERY_CHUNKS = 64;

/**
 * 주변 메모: 메모 전체를 하나의 질의로 삼아 메모 단위로 순위를 매긴다.
 * 문장마다 임베딩한 뒤 워커가 중심화 평균을 내므로, 긴 메모가 앞 1000자로
 * 잘리지 않고 여러 주제가 섞인 메모도 한 방향으로 뭉개지지 않는다.
 */
export const searchNearbyMemos = async ({
  api = getApi(),
  limit,
  memoId,
  minimumSimilarity,
  ownerId,
  queryText,
  signal,
}: {
  api?: LocalMemoSearchApi;
  limit: number;
  memoId: string | null;
  minimumSimilarity: number;
  ownerId: string | null;
  queryText: string;
  signal?: AbortSignal;
}): Promise<NetworkSearchResponse> => {
  throwIfAborted(signal);
  const text = queryText.trim();
  // Same chunks and normalization as the indexer, so the query sits in the
  // same space as the stored document vectors it is compared with.
  // (localEmbed adds the query prefix; bge-m3 has none. A model with
  // passage/query prefixes would need passage vectors here.)
  const texts = chunkMemoText(text)
    .map(chunk => chunk.text)
    .filter(chunk => isMeaningfulChunk(chunk) && hasSearchableContent(chunk))
    .map(normalizeChunkText)
    .slice(0, NEARBY_MAX_QUERY_CHUNKS);
  if (texts.length === 0) {
    return {
      message: LOCAL_SEARCH_EMPTY_MESSAGE,
      queryChunk: null,
      results: [],
    };
  }

  await api.localDbSetOwner(ownerId);
  throwIfAborted(signal);
  const queryVectors = await api.localEmbed(texts);
  throwIfAborted(signal);
  const rows = await api.localDbSearchSimilarMemos(
    ownerId,
    queryVectors,
    memoId,
    limit,
    minimumSimilarity,
  );
  throwIfAborted(signal);
  const results = [
    ...rows.memos.map(row => toMemoResult(row)),
    ...rows.inbox.map(toInboxResult),
  ]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);

  return {
    message: results.length === 0 ? LOCAL_SEARCH_EMPTY_MESSAGE : null,
    queryChunk: {
      end: text.length,
      id: `local-query-${hashText(text)}`,
      index: 0,
      start: 0,
      text,
    },
    results,
  };
};
