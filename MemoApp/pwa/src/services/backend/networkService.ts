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
  cursorIndex,
  limit,
  memoId,
  text,
}: {
  cursorIndex: number;
  limit?: number;
  memoId: string | null;
  text: string;
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

  const response = await fetch(
    `${backendUrl.replace(/\/$/, '')}/network/search`,
    {
      body: JSON.stringify({
        cursor_index: cursorIndex,
        limit,
        memo_id: memoId,
        text,
      }),
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`Network search failed: ${response.status}`);
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
