import { MEMO_BACKEND_URL } from '@env';

import { MemoChunk } from '../../lib/memoChunker';
import { isSupabaseConfigured, supabase } from '../supabase/client';

export interface NetworkSearchResult {
  endIndex: number;
  memoId: string;
  chunkId: string;
  chunkText: string;
  memoCreatedAt: number | null;
  memoContent: string;
  memoUpdatedAt: number | null;
  startIndex: number;
  similarity: number;
}

export interface NetworkSearchResponse {
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
  message?: string | null;
}

interface BackendNetworkSearchResponse {
  query_chunk: MemoChunk | null;
  results: Array<{
    memo_id: string;
    chunk_id: string;
    chunk_text: string;
    memo_content: string;
    start_index: number;
    end_index: number;
    memo_created_at: string | null;
    memo_updated_at: string | null;
    similarity: number;
  }>;
  message?: string | null;
}

const getBackendUrl = () => {
  return typeof MEMO_BACKEND_URL === 'string' ? MEMO_BACKEND_URL.trim() : '';
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
    throw new Error('MEMO_BACKEND_URL is not configured.');
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user || !session?.access_token) {
    throw new Error('Network search requires device sync login.');
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
      memoCreatedAt: result.memo_created_at
        ? new Date(result.memo_created_at).getTime()
        : null,
      memoContent: result.memo_content,
      memoId: result.memo_id,
      memoUpdatedAt: result.memo_updated_at
        ? new Date(result.memo_updated_at).getTime()
        : null,
      startIndex: result.start_index,
      similarity: result.similarity,
    })),
  };
};
