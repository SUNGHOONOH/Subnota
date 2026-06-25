import { MemoChunk } from '../../lib/memoChunker';
import { isSupabaseConfigured, supabase } from '../supabase/client';

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

export class NetworkRequestError extends Error {
  retryAfterSeconds: number | null;
  retryable: boolean;
  status: number | null;

  constructor(
    message: string,
    options: {
      retryAfterSeconds?: number | null;
      retryable?: boolean;
      status?: number | null;
    } = {},
  ) {
    super(message);
    this.name = 'NetworkRequestError';
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
  }
}

interface BackendNetworkSearchResponse {
  message?: string | null;
  query_chunk: MemoChunk | null;
  results: Array<{
    chunk_id: string;
    chunk_text: string;
    created_at?: string | null;
    end_index: number;
    inbox_session_id?: string | null;
    memo_content: string | null;
    memo_created_at: string | null;
    memo_id: string | null;
    memo_updated_at: string | null;
    similarity: number;
    source_kind?: 'memo' | 'inbox';
    source_label?: string | null;
    source_type?: string | null;
    source_url?: string | null;
    start_index: number;
    thumbnail_url?: string | null;
    title?: string | null;
  }>;
}

const getBackendUrl = () => {
  return (import.meta.env.VITE_MEMO_BACKEND_URL ?? '').trim();
};

export const searchCursorNetwork = async ({
  limit,
  minimumSimilarity,
  memoId,
  cursorIndex,
  queryText,
  signal,
  timeoutMs = 20000,
}: {
  limit?: number;
  minimumSimilarity?: number;
  memoId: string | null;
  // Markdown char offset of the cursor in the active memo. When provided the
  // backend can snap to the exact indexed chunk and serve precomputed
  // neighbours; omit it to let the backend fall back to text matching.
  cursorIndex?: number | null;
  queryText: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<NetworkSearchResponse> => {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    throw new Error('VITE_MEMO_BACKEND_URL is not configured.');
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Network search requires login.');
  }

  const controller = new AbortController();
  let didTimeout = false;
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(
      `${backendUrl.replace(/\/$/, '')}/network/search`,
      {
        body: JSON.stringify({
          cursor_index: cursorIndex ?? null,
          limit,
          memo_id: memoId,
          minimum_similarity: minimumSimilarity,
          query_text: queryText,
        }),
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      if (didTimeout) {
        throw new NetworkRequestError(
          '네트워크 검색 시간이 초과되었습니다.',
          { retryable: true },
        );
      }
      throw new DOMException('Network search was cancelled.', 'AbortError');
    }
    throw new NetworkRequestError(
      error instanceof Error ? error.message : '네트워크 검색에 실패했습니다.',
      { retryable: true },
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : null;
    let detail = '';
    try {
      const errorPayload = (await response.json()) as { detail?: string };
      detail = errorPayload.detail ?? '';
    } catch {
      // Keep the status-based fallback below when the body is not JSON.
    }
    const retryable = response.status === 429 || response.status >= 500;
    throw new NetworkRequestError(
      detail ||
        (response.status === 429
          ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
          : `네트워크 검색에 실패했습니다. (${response.status})`),
      {
        retryAfterSeconds:
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds !== null
            ? retryAfterSeconds
            : null,
        retryable,
        status: response.status,
      },
    );
  }

  const payload = (await response.json()) as BackendNetworkSearchResponse;

  return {
    message: payload.message,
    queryChunk: payload.query_chunk,
    results: payload.results.map(result => ({
      chunkId: result.chunk_id,
      chunkText: result.chunk_text,
      createdAt: result.created_at ? new Date(result.created_at).getTime() : null,
      endIndex: result.end_index,
      inboxSessionId: result.inbox_session_id ?? null,
      memoContent: result.memo_content,
      memoCreatedAt: result.memo_created_at
        ? new Date(result.memo_created_at).getTime()
        : null,
      memoId: result.memo_id ?? null,
      memoUpdatedAt: result.memo_updated_at
        ? new Date(result.memo_updated_at).getTime()
        : null,
      similarity: result.similarity,
      sourceKind: result.source_kind ?? 'memo',
      sourceLabel: result.source_label ?? null,
      sourceType: result.source_type ?? null,
      sourceUrl: result.source_url ?? null,
      startIndex: result.start_index,
      thumbnailUrl: result.thumbnail_url ?? null,
      title: result.title ?? null,
    })),
  };
};
