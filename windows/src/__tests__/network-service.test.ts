import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'token' } },
      })),
      refreshSession: vi.fn(async () => ({
        data: { session: { access_token: 'refreshed-token' } },
      })),
    },
  },
}));

describe('networkService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MEMO_BACKEND_URL', 'https://backend.example.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends the similarity threshold and maps an empty result', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        minimum_similarity: 0.48,
        query_text: '테스트 문장',
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify({ query_chunk: null, results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchCursorNetwork } = await import('../services/backend/networkService');
    const response = await searchCursorNetwork({
      memoId: 'memo-1',
      minimumSimilarity: 0.48,
      queryText: '테스트 문장',
    });

    expect(response.results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks rate-limit failures as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: '잠시 후 다시 시도해 주세요.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '7' },
        }),
      ),
    );

    const { searchCursorNetwork } = await import(
      '../services/backend/networkService'
    );

    await expect(
      searchCursorNetwork({ memoId: null, queryText: '테스트' }),
    ).rejects.toMatchObject({
      retryAfterSeconds: 7,
      retryable: true,
      status: 429,
    });
  });

  it('refreshes the session once and retries after a 401 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ query_chunk: null, results: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { searchCursorNetwork } = await import('../services/backend/networkService');
    await expect(
      searchCursorNetwork({ memoId: null, queryText: '테스트' }),
    ).resolves.toMatchObject({ results: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer token',
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer refreshed-token',
    });
  });

  it('formats browser-level fetch failures as retryable errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const {
      NETWORK_SEARCH_RETRY_MESSAGE,
      formatNetworkSearchErrorMessage,
      searchCursorNetwork,
    } = await import('../services/backend/networkService');

    await expect(
      searchCursorNetwork({ memoId: null, queryText: '테스트' }),
    ).rejects.toMatchObject({
      retryable: true,
      status: null,
    });

    await searchCursorNetwork({ memoId: null, queryText: '테스트' }).catch(
      error => {
        expect(formatNetworkSearchErrorMessage(error)).toBe(
          NETWORK_SEARCH_RETRY_MESSAGE,
        );
      },
    );
  });
});
