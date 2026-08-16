import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { createKeyedMutationQueue } from '../../lib/keyedMutationQueue';

export type InboxSourceType = 'youtube' | 'instagram' | 'url' | 'image';
export type InboxSummaryStatus =
  | 'pending'
  | 'ready'
  | 'partial'
  | 'unsupported'
  | 'failed';

export interface InboxSession {
  canonicalUrl: string | null;
  channelTitle: string | null;
  clientId?: string | null;
  createdAt: string;
  description: string | null;
  domain: string | null;
  duration: string | null;
  id: string;
  keywords: string[];
  liked: boolean;
  originalUrl: string | null;
  publishedAt: string | null;
  selectedText: string | null;
  sourceType: InboxSourceType;
  summary: string | null;
  summaryBasis: string | null;
  summaryDetail: string | null;
  summaryOneLiner: string | null;
  summaryProvider: string | null;
  summarySearchText: string | null;
  summaryStatus: InboxSummaryStatus;
  thumbnailUrl: string | null;
  title: string | null;
  userNote: string | null;
}

interface InboxSessionRow {
  canonical_url: string | null;
  client_id?: string | null;
  created_at: string;
  description: string | null;
  domain: string | null;
  id: string;
  keywords?: string[] | null;
  liked?: boolean | null;
  original_url: string | null;
  selected_text: string | null;
  source_type: InboxSourceType;
  summary: string | null;
  summary_basis: string | null;
  summary_detail: string | null;
  summary_one_liner: string | null;
  summary_provider: string | null;
  summary_search_text: string | null;
  summary_status: InboxSummaryStatus;
  thumbnail_url: string | null;
  title: string | null;
  user_note: string | null;
  metadata?: {
    author_name?: string | null;
    channel_title?: string | null;
    duration?: string | null;
    published_at?: string | null;
  } | null;
}

const getBackendUrl = () => {
  return (import.meta.env.VITE_MEMO_BACKEND_URL ?? '').trim();
};

export const INBOX_REQUEST_TIMEOUT_MS = 20000;

interface InboxRequestAuth {
  initialAccessToken: string;
  ownerId: string;
}

const captureInboxRequestAuth = (session: Session): InboxRequestAuth => ({
  initialAccessToken: session.access_token,
  ownerId: session.user.id,
});

const requestBackend = async <T>(
  auth: InboxRequestAuth,
  path: string,
  init: RequestInit = {},
) => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_MEMO_BACKEND_URL is not configured.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { initialAccessToken, ownerId } = auth;
  if (!ownerId || !initialAccessToken) {
    throw new Error('Inbox requires login.');
  }

  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      controller.abort();
      reject(new Error('Inbox request timed out.'));
    }, INBOX_REQUEST_TIMEOUT_MS);
  });
  const operation = (async () => {
    const request = (accessToken: string) =>
      fetch(`${backendUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

    let response = await request(initialAccessToken);
    if (response.status === 401) {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (
        !currentSession?.access_token ||
        currentSession.user.id !== ownerId
      ) {
        throw new Error('Inbox session changed during request.');
      }
      response = await request(currentSession.access_token);
    }

    if (!response.ok) {
      throw new Error(`Inbox request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  })();

  try {
    // The same upper bound covers connection setup and reading a stalled body.
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
};

export const fetchInboxSessions = async (session: Session) => {
  const auth = captureInboxRequestAuth(session);
  const payload = await requestBackend<{ items: InboxSessionRow[] }>(
    auth,
    '/inbox/sessions?limit=50',
  );
  return payload.items.map(mapInboxSession);
};

export const createInboxSession = async (
  session: Session,
  {
    clientId,
    rawSharedText,
    selectedText,
    url,
    userNote,
  }: {
    clientId?: string | null;
    rawSharedText?: string | null;
    selectedText?: string | null;
    url: string;
    userNote?: string | null;
  },
) => {
  const auth = captureInboxRequestAuth(session);
  const payload = await requestBackend<{ item: InboxSessionRow }>(
    auth,
    '/inbox/sessions',
    {
      body: JSON.stringify({
        client_id: clientId,
        raw_shared_text: rawSharedText,
        selected_text: selectedText,
        url,
        user_note: userNote,
      }),
      method: 'POST',
    },
  );
  return mapInboxSession(payload.item);
};

// 요약 재시도는 실패한 항목을 사용자가 명시적으로 요청했을 때만 한다.
// 새 세션을 만들지 않고 같은 session_id를 다시 분석하므로 카드가 중복되지 않는다.
export const retryInboxSessionSummary = async (
  session: Session,
  sessionId: string,
) => {
  const auth = captureInboxRequestAuth(session);
  const payload = await requestBackend<{ item: InboxSessionRow }>(
    auth,
    '/inbox/sessions/analyze',
    {
      body: JSON.stringify({ session_id: sessionId }),
      method: 'POST',
    },
  );
  return mapInboxSession(payload.item);
};

// Like/favorite toggle goes through the backend: inbox_sessions has no client
// RLS policy (client grants were revoked in the 2026-06-23 security migration),
// so a direct Supabase update silently fails. The backend scopes the row by the
// user id derived from the bearer token.
const inboxLikeWriteQueue = createKeyedMutationQueue();

export const setInboxLiked = (session: Session, id: string, liked: boolean) => {
  const auth = captureInboxRequestAuth(session);
  return inboxLikeWriteQueue.enqueue(`${auth.ownerId}\u0000${id}`, async () => {
    await requestBackend(
      auth,
      `/inbox/sessions/${encodeURIComponent(id)}/liked`,
      {
        body: JSON.stringify({ liked }),
        method: 'PATCH',
      },
    );
  });
};

// 백엔드 멱등 삭제 — 이미 없는 세션이어도 성공으로 응답한다.
export const deleteInboxSession = async (session: Session, id: string) => {
  const auth = captureInboxRequestAuth(session);
  await requestBackend(
    auth,
    `/inbox/sessions/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
};

export const deleteInboxSessionByClientId = async (
  session: Session,
  clientId: string,
) => {
  const auth = captureInboxRequestAuth(session);
  const payload = await requestBackend<{ deleted: boolean }>(
    auth,
    `/inbox/sessions/by-client-id/${encodeURIComponent(clientId)}`,
    { method: 'DELETE' },
  );
  return payload.deleted;
};

const mapInboxSession = (row: InboxSessionRow): InboxSession => ({
  canonicalUrl: row.canonical_url,
  channelTitle: row.metadata?.channel_title ?? row.metadata?.author_name ?? null,
  clientId: row.client_id ?? null,
  createdAt: row.created_at,
  description: row.description,
  domain: row.domain,
  duration: row.metadata?.duration ?? null,
  id: row.id,
  keywords: row.keywords ?? [],
  liked: row.liked ?? false,
  originalUrl: row.original_url,
  publishedAt: row.metadata?.published_at ?? null,
  selectedText: row.selected_text,
  sourceType: row.source_type,
  summary: row.summary,
  summaryBasis: row.summary_basis,
  summaryDetail: row.summary_detail,
  summaryOneLiner: row.summary_one_liner,
  summaryProvider: row.summary_provider,
  summarySearchText: row.summary_search_text,
  summaryStatus: row.summary_status,
  thumbnailUrl: row.thumbnail_url,
  title: row.title,
  userNote: row.user_note,
});
