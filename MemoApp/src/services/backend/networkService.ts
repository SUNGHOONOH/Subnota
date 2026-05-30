import { MEMO_BACKEND_URL } from '@env';

import { MemoChunk } from '../../lib/memoChunker';
import { isSupabaseConfigured, supabase } from '../supabase/client';

export interface NetworkSearchResult {
  endIndex: number;
  sourceKind: 'memo' | 'inbox';
  sourceLabel: string | null;
  memoId: string | null;
  inboxSessionId: string | null;
  chunkId: string;
  chunkText: string;
  memoCreatedAt: number | null;
  memoContent: string | null;
  memoUpdatedAt: number | null;
  startIndex: number;
  similarity: number;
  sourceType: string | null;
  title: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: number | null;
}

export interface NetworkSearchResponse {
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
  message?: string | null;
}

interface BackendNetworkSearchResponse {
  query_chunk: MemoChunk | null;
  results: Array<{
    source_kind?: 'memo' | 'inbox';
    source_label?: string | null;
    memo_id: string | null;
    inbox_session_id?: string | null;
    chunk_id: string;
    chunk_text: string;
    memo_content: string | null;
    start_index: number;
    end_index: number;
    memo_created_at: string | null;
    memo_updated_at: string | null;
    similarity: number;
    source_type?: string | null;
    title?: string | null;
    source_url?: string | null;
    thumbnail_url?: string | null;
    created_at?: string | null;
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
      createdAt: result.created_at ? new Date(result.created_at).getTime() : null,
      endIndex: result.end_index,
      inboxSessionId: result.inbox_session_id ?? null,
      memoCreatedAt: result.memo_created_at
        ? new Date(result.memo_created_at).getTime()
        : null,
      memoContent: result.memo_content,
      memoId: result.memo_id ?? null,
      memoUpdatedAt: result.memo_updated_at
        ? new Date(result.memo_updated_at).getTime()
        : null,
      sourceKind: result.source_kind ?? 'memo',
      sourceLabel: result.source_label ?? null,
      sourceType: result.source_type ?? null,
      sourceUrl: result.source_url ?? null,
      startIndex: result.start_index,
      thumbnailUrl: result.thumbnail_url ?? null,
      title: result.title ?? null,
      similarity: result.similarity,
    })),
  };
};
