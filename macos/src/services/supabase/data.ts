import { Session } from '@supabase/supabase-js';

import { hashText } from '../../lib/contentHash';
import { getMemoCategory } from '../../lib/memoCategory';
import {
  BriefingRow,
  CalendarBlockRow,
  MemoRow,
  ScheduleInboxRow,
  TopicCluster,
  TopicMapData,
  TopicMemoEdge,
  TopicMembership,
} from '../../types';
import { supabase } from './client';

export const ensureProfile = async (userId: string) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id' });

  if (error) {
    throw error;
  }
};

export const getSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
};

export const signInWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session;
};

export const signUpWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session;
};

export const resendSignupOtp = async (email: string) => {
  const { error } = await supabase.auth.resend({
    email,
    type: 'signup',
  });

  if (error) {
    throw error;
  }
};

export const verifySignupOtp = async (email: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    throw error;
  }

  return data.session;
};

export const OAUTH_REDIRECT_URL = 'subnota://auth/callback';

// Build the provider authorize URL (PKCE) without navigating the renderer.
// signInWithOAuth stores the PKCE code_verifier in this client's storage, so
// the same client must later call exchangeCodeForSession with the returned code.
export const createProviderAuthUrl = async (provider: 'google' | 'kakao') => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo: OAUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
    provider,
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('OAuth 로그인 URL을 만들지 못했습니다.');
  }

  return data.url;
};

export const exchangeOAuthCode = async (code: string) => {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }

  return data.session;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};

// Password recovery via 6-digit OTP. The recovery email must use the
// {{ .Token }} template (not a link) for a code to be delivered.
export const sendPasswordResetOtp = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    throw error;
  }
};

export const verifyRecoveryOtp = async (email: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'recovery',
  });

  if (error) {
    throw error;
  }

  return data.session;
};

// updateUser requires an active session, which verifyRecoveryOtp establishes.
export const updateUserPassword = async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }
};

export const fetchMemos = async (session: Session) => {
  await ensureProfile(session.user.id);

  const { data, error } = await supabase
    .from('memos')
    .select('id, content, content_hash, synced_content_hash, content_updated_at, category, is_archived, created_at, updated_at')
    .eq('user_id', session.user.id)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MemoRow[];
};

export type UpsertMemoResult =
  | { memo: MemoRow; status: 'conflict' | 'inserted' | 'updated' }
  | { memo: null; status: 'deleted' };

export const upsertMemo = async (
  session: Session,
  memo: {
    baseHash?: string | null;
    category?: string | null;
    content: string;
    contentUpdatedAt?: string;
    createdAt?: string;
    id: string;
  },
): Promise<UpsertMemoResult> => {
  const contentHash = hashText(memo.content);
  const contentUpdatedAt = memo.contentUpdatedAt ?? new Date().toISOString();
  const createdAt = memo.createdAt ?? new Date().toISOString();

  // Optimistic-concurrency upsert: on a concurrent edit the server keeps its
  // version and preserves ours as a conflict copy (returned via next fetchMemos)
  // instead of letting this push blindly overwrite it.
  const { data, error } = await supabase.rpc('upsert_memo_if_base_hash', {
    p_id: memo.id,
    p_base_hash: memo.baseHash ?? null,
    p_content: memo.content,
    p_content_hash: contentHash,
    p_category: getMemoCategory(memo.category),
    p_content_updated_at: contentUpdatedAt,
    p_created_at: createdAt,
  });

  if (error) {
    throw error;
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | { content: string | null; content_hash: string | null; status: string }
    | undefined;

  if (!result) {
    throw new Error('upsert_memo_if_base_hash returned no row');
  }

  if (result.status === 'deleted') {
    return { memo: null, status: 'deleted' };
  }

  // For 'conflict' the canonical content is the server's; for insert/update it
  // is ours. Exact timestamps are reconciled on the next fetchMemos.
  const canonicalContent = result.content ?? memo.content;
  const canonicalHash = result.content_hash ?? contentHash;
  const row: MemoRow = {
    category: getMemoCategory(memo.category),
    content: canonicalContent,
    content_hash: canonicalHash,
    content_updated_at: contentUpdatedAt,
    created_at: createdAt,
    id: memo.id,
    is_archived: false,
    synced_content_hash: canonicalHash,
    updated_at: contentUpdatedAt,
  };

  return { memo: row, status: result.status as 'conflict' | 'inserted' | 'updated' };
};

export const archiveMemo = async (session: Session, memoId: string) => {
  const { error } = await supabase
    .from('memos')
    .update({ is_archived: true })
    .eq('id', memoId)
    .eq('user_id', session.user.id);

  if (error) {
    throw error;
  }
};

export const fetchCalendarBlocks = async (session: Session) => {
  const { data, error } = await supabase
    .from('calendar_blocks')
    .select(
      'id, title, note, start_date, end_date, all_day, all_day_date, time_zone, order, color, is_completed, created_at, updated_at',
    )
    .eq('user_id', session.user.id)
    .order('start_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CalendarBlockRow[];
};

const toLocalCalendarDate = (value: string) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const upsertCalendarBlock = async (
  session: Session,
  block: {
    allDay: boolean;
    color: string;
    id: string;
    note: string | null;
    order?: number;
    startDate: string;
    title: string;
  },
) => {
  const { data, error } = await supabase
    .from('calendar_blocks')
    .upsert(
      {
        id: block.id,
        user_id: session.user.id,
        title: block.title.trim() || '새 일정',
        note: block.note,
        start_date: block.startDate,
        end_date: null,
        all_day: block.allDay,
        all_day_date: block.allDay ? toLocalCalendarDate(block.startDate) : null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        order: block.order ?? 0,
        color: block.color,
        is_completed: false,
      },
      { onConflict: 'id' },
    )
    .select(
      'id, title, note, start_date, end_date, all_day, all_day_date, time_zone, order, color, is_completed, created_at, updated_at',
    )
    .single();

  if (error) {
    throw error;
  }

  return data as CalendarBlockRow;
};

export const deleteCalendarBlock = async (session: Session, blockId: string) => {
  const { error } = await supabase
    .from('calendar_blocks')
    .delete()
    .eq('id', blockId)
    .eq('user_id', session.user.id);

  if (error) {
    throw error;
  }
};

export const fetchScheduleInbox = async (session: Session) => {
  const { data, error } = await supabase
    .from('schedule_inbox')
    .select(
      'id, memo_id, title, source_text, scheduled_at, time_text, all_day, confidence, status',
    )
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(30);

  if (error) {
    throw error;
  }

  return (data ?? []) as ScheduleInboxRow[];
};

export const updateScheduleInboxStatus = async (
  session: Session,
  id: string,
  status: 'accepted' | 'dismissed',
) => {
  const { error } = await supabase
    .from('schedule_inbox')
    .update({ status })
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    throw error;
  }
};

export const fetchBriefings = async (session: Session) => {
  const { data, error } = await supabase
    .from('briefings')
    .select('id, content, type, briefing_date, metadata, created_at')
    .eq('user_id', session.user.id)
    .eq('type', 'daily')
    .order('briefing_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  return (data ?? []) as BriefingRow[];
};

interface TopicClusterRow {
  confidence: number | null;
  id: string;
  keywords: string[] | null;
  label: string;
  memo_count: number | null;
  representative_memo_ids: string[] | null;
}

interface TopicMembershipRow {
  memo_id: string;
  score: number | null;
  topic_id: string;
}

interface TopicMemoEdgeRow {
  similarity: number;
  source_memo_id: string;
  target_memo_id: string;
  topic_id: string;
}

export const fetchTopicMap = async (session: Session): Promise<TopicMapData> => {
  const { data: clusterData, error: clusterError } = await supabase
    .from('topic_clusters')
    .select('id, label, keywords, representative_memo_ids, memo_count, confidence')
    .eq('user_id', session.user.id)
    .order('memo_count', { ascending: false });

  if (clusterError) {
    throw clusterError;
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from('topic_cluster_memos')
    .select('topic_id, memo_id, score');

  if (membershipError) {
    throw membershipError;
  }

  const edgeResult = await supabase
    .from('topic_memo_edges')
    .select('topic_id, source_memo_id, target_memo_id, similarity');
  const edgeData = edgeResult.error ? [] : edgeResult.data ?? [];

  const clusters: TopicCluster[] = ((clusterData ?? []) as TopicClusterRow[]).map(
    row => ({
      confidence: row.confidence,
      id: row.id,
      keywords: row.keywords ?? [],
      label: row.label,
      memoCount: row.memo_count ?? 0,
      representativeMemoIds: row.representative_memo_ids ?? [],
    }),
  );
  const memberships: TopicMembership[] = (
    (membershipData ?? []) as TopicMembershipRow[]
  ).map(row => ({
    memoId: row.memo_id,
    score: row.score,
    topicId: row.topic_id,
  }));
  const edges: TopicMemoEdge[] = (edgeData as TopicMemoEdgeRow[]).map(row => ({
    similarity: row.similarity,
    sourceMemoId: row.source_memo_id,
    targetMemoId: row.target_memo_id,
    topicId: row.topic_id,
  }));

  return { clusters, edges, memberships };
};
