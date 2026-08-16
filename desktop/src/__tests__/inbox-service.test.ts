import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../services/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      refreshSession: authMocks.refreshSession,
    },
  },
}));

import {
  INBOX_REQUEST_TIMEOUT_MS,
  deleteInboxSessionByClientId,
  fetchInboxSessions,
  retryInboxSessionSummary,
  setInboxLiked,
} from '../services/backend/inboxService';

const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');
const makeSession = (ownerId: string, accessToken: string) =>
  ({
    access_token: accessToken,
    user: { id: ownerId },
  }) as Session;
const ownerASession = makeSession('owner-a', 'owner-a-token');

describe('Inbox backend requests', () => {
  beforeEach(() => {
    authMocks.getSession.mockReset();
    authMocks.refreshSession.mockReset();
    vi.stubEnv('VITE_MEMO_BACKEND_URL', 'https://backend.example.com');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('aborts and rejects when fetch itself exceeds the request timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );

    const request = fetchInboxSessions(ownerASession);
    const rejected = expect(request).rejects.toThrow('Inbox request timed out.');
    await vi.advanceTimersByTimeAsync(INBOX_REQUEST_TIMEOUT_MS);

    await rejected;
    expect(signal?.aborted).toBe(true);
  });

  it('rejects when reading the response body exceeds the same timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return {
          json: () => new Promise<never>(() => undefined),
          ok: true,
          status: 200,
        } as Response;
      }),
    );

    const request = fetchInboxSessions(ownerASession);
    const rejected = expect(request).rejects.toThrow('Inbox request timed out.');
    await vi.advanceTimersByTimeAsync(INBOX_REQUEST_TIMEOUT_MS);

    await rejected;
    expect(signal?.aborted).toBe(true);
  });

  it('sends rapid like intents for one item to the server in click order', async () => {
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toContain('/inbox/sessions/inbox-rapid-like/liked');
      expect(init?.method).toBe('PATCH');
      return new Promise<Response>(resolve => {
        releases.push(() => {
          resolve(
            new Response(JSON.stringify({ item: {} }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }),
          );
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = setInboxLiked(ownerASession, 'inbox-rapid-like', true);
    const latest = setInboxLiked(ownerASession, 'inbox-rapid-like', false);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      liked: true,
    });
    releases[0]?.();
    await first;

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      liked: false,
    });
    releases[1]?.();
    await latest;
  });

  it('captures queued like authentication at call time', async () => {
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn(() => {
      return new Promise<Response>(resolve => {
        releases.push(() => {
          resolve(
            new Response(JSON.stringify({ item: {} }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }),
          );
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const queuedSession = makeSession('owner-a', 'queued-owner-a-token');

    const blocker = setInboxLiked(ownerASession, 'queued-auth', true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const queued = setInboxLiked(queuedSession, 'queued-auth', false);
    queuedSession.access_token = 'owner-b-token';
    queuedSession.user.id = 'owner-b';

    releases[0]?.();
    await blocker;
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer queued-owner-a-token');
    releases[1]?.();
    await queued;
  });

  it('uses the session captured by the caller instead of the global current session', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: makeSession('owner-b', 'owner-b-token') },
    });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchInboxSessions(ownerASession);

    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer owner-a-token');
    expect(authMocks.getSession).not.toHaveBeenCalled();
  });

  it('retries one 401 with a newer token only when the current owner is unchanged', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: makeSession('owner-a', 'owner-a-new-token') },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await fetchInboxSessions(ownerASession);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.map(call =>
        new Headers(call[1]?.headers).get('Authorization'),
      ),
    ).toEqual(['Bearer owner-a-token', 'Bearer owner-a-new-token']);
    expect(authMocks.getSession).toHaveBeenCalledTimes(1);
    expect(authMocks.refreshSession).not.toHaveBeenCalled();
  });

  it('does not resend an owner A request with owner B token after a 401', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: makeSession('owner-b', 'owner-b-token') },
    });
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchInboxSessions(ownerASession)).rejects.toThrow(
      'Inbox session changed during request.',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer owner-a-token');
    expect(authMocks.refreshSession).not.toHaveBeenCalled();
  });

  it('does not serialize like writes for the same item across different owners', async () => {
    const releases = new Map<string, () => void>();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('Authorization') ?? '';
      return new Promise<Response>(resolve => {
        releases.set(authorization, () => {
          resolve(
            new Response(JSON.stringify({ item: {} }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }),
          );
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const ownerBSession = makeSession('owner-b', 'owner-b-token');

    const ownerAWrite = setInboxLiked(ownerASession, 'shared-id', true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const ownerBWrite = setInboxLiked(ownerBSession, 'shared-id', false);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    releases.get('Bearer owner-a-token')?.();
    releases.get('Bearer owner-b-token')?.();
    await Promise.all([ownerAWrite, ownerBWrite]);
  });

  it('deletes by owner-scoped client id without depending on a list response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ deleted: true, status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      deleteInboxSessionByClientId(ownerASession, 'client/id'),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/inbox/sessions/by-client-id/client%2Fid',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('retries a summary only for the explicitly selected inbox session', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ item: {} }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await retryInboxSessionSummary(ownerASession, 'inbox-summary-failed');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/inbox/sessions/analyze',
      expect.objectContaining({
        body: JSON.stringify({ session_id: 'inbox-summary-failed' }),
        method: 'POST',
      }),
    );
  });
});

describe('Inbox optimistic mutation guards', () => {
  it('does not leave refresh loading stuck when the same owner rotates tokens', () => {
    const refresh = appSource.slice(
      appSource.indexOf('const refreshInbox'),
      appSource.indexOf('const inboxSourceLabel'),
    );

    expect(refresh).toContain(
      'sessionRef.current?.user.id === ownerId',
    );
    expect(refresh).toContain(
      'inboxRefreshSequenceRef.current === requestSequence',
    );
    expect(refresh).toContain(
      'if (isCurrentInboxRequest()) {\n        setInboxLoading(false);',
    );
  });

  it('suppresses and deletes a server response for a pending item the user deleted', () => {
    const saveHandler = appSource.slice(
      appSource.indexOf('const saveInboxUrl'),
      appSource.indexOf('const toggleInboxLike'),
    );

    expect(saveHandler).toContain(
      'deletedPendingInboxClientIdsRef.current.has(localItem.clientId)',
    );
    expect(saveHandler.match(/await discardIfDeleted\(\)/g)).toHaveLength(3);
    expect(saveHandler.indexOf('await discardIfDeleted()')).toBeLessThan(
      saveHandler.indexOf('await cacheLocalInboxItem(item, ownerId)'),
    );
  });

  it('restores a persisted delete tombstone and removes it only after server deletion', () => {
    const hydration = appSource.slice(
      appSource.indexOf('const applyLocalWorkspace'),
      appSource.indexOf('const syncPendingLocalWorkspace'),
    );
    const discard = appSource.slice(
      appSource.indexOf('const discardDeletedPendingInboxItem'),
      appSource.indexOf('const retryDeletedPendingInboxItems'),
    );
    const deleteHandler = appSource.slice(
      appSource.indexOf('const deleteInboxItem'),
      appSource.indexOf('const saveInboxUrlRef'),
    );

    expect(hydration).toContain("item.local_sync_status === 'pending_delete'");
    expect(deleteHandler).toContain('await tombstoneWrite');
    const serverDeleteIndex = discard.indexOf(
      'await deleteInboxSessionByClientId(currentSession, clientId)',
    );
    expect(serverDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(serverDeleteIndex).toBeLessThan(
      discard.indexOf('await removeLocalInboxSession(clientId, ownerId)'),
    );
    expect(appSource).toContain('if (!deleted) continue;');
  });

  it('only lets the latest like callback update UI or local cache', () => {
    const likeHandler = appSource.slice(
      appSource.indexOf('const toggleInboxLike'),
      appSource.indexOf('const deleteInboxItem'),
    );

    expect(likeHandler).toContain('inboxLikeRevisionsRef.current.set(id, revision)');
    expect(likeHandler.match(/if \(!isLatest\(\)\)/g)).toHaveLength(2);
    expect(likeHandler).toContain('cached && isLatest()');
  });
});
