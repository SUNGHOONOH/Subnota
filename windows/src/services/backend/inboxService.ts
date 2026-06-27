import { isSupabaseConfigured, supabase } from '../supabase/client';

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

const getAccessToken = async (refresh = false) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  if (refresh) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    return session?.access_token ?? null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Inbox requires login.');
  }

  return session.access_token;
};

const requestBackend = async <T>(path: string, init: RequestInit = {}) => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('VITE_MEMO_BACKEND_URL is not configured.');
  }

  const token = await getAccessToken();
  const request = (accessToken: string) =>
    fetch(`${backendUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  let response = await request(token);
  if (response.status === 401) {
    const refreshedToken = await getAccessToken(true);
    if (refreshedToken && refreshedToken !== token) {
      response = await request(refreshedToken);
    }
  }

  if (!response.ok) {
    throw new Error(`Inbox request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

export const fetchInboxSessions = async () => {
  const payload = await requestBackend<{ items: InboxSessionRow[] }>(
    '/inbox/sessions?limit=50',
  );
  return payload.items.map(mapInboxSession);
};

export const createInboxSession = async ({
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
}) => {
  const payload = await requestBackend<{ item: InboxSessionRow }>(
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

const mapInboxSession = (row: InboxSessionRow): InboxSession => ({
  canonicalUrl: row.canonical_url,
  channelTitle: row.metadata?.channel_title ?? row.metadata?.author_name ?? null,
  clientId: row.client_id ?? null,
  createdAt: row.created_at,
  description: row.description,
  domain: row.domain,
  duration: row.metadata?.duration ?? null,
  id: row.id,
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
