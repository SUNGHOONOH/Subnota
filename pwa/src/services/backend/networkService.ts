import { MemoChunk } from '../../lib/memoChunker';
import { isSupabaseConfigured, supabase } from '../supabase/client';

export interface NetworkSearchResult {
  chunkId: string;
  chunkText: string;
  endIndex: number;
  memoContent: string;
  memoCreatedAt: number | null;
  memoId: string;
  memoUpdatedAt: number | null;
  similarity: number;
  startIndex: number;
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
    end_index: number;
    memo_content: string;
    memo_created_at: string | null;
    memo_id: string;
    memo_updated_at: string | null;
    similarity: number;
    start_index: number;
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
      endIndex: result.end_index,
      memoContent: result.memo_content,
      memoCreatedAt: result.memo_created_at
        ? new Date(result.memo_created_at).getTime()
        : null,
      memoId: result.memo_id,
      memoUpdatedAt: result.memo_updated_at
        ? new Date(result.memo_updated_at).getTime()
        : null,
      similarity: result.similarity,
      startIndex: result.start_index,
    })),
  };
};
