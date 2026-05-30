import { Session } from '@supabase/supabase-js';

import { hashText } from '../../lib/contentHash';
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

export const signInWithProvider = async (provider: 'google' | 'kakao') => {
  const { error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo: new URL(
        `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}auth/callback`,
        window.location.origin,
      ).toString(),
    },
    provider,
  });

  if (error) {
    throw error;
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};

export const fetchMemos = async (session: Session) => {
  await ensureProfile(session.user.id);

  const { data, error } = await supabase
    .from('memos')
    .select('id, content, content_hash, is_archived, created_at, updated_at')
    .eq('user_id', session.user.id)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MemoRow[];
};

export const upsertMemo = async (
  session: Session,
  memo: { content: string; createdAt?: string; id: string },
) => {
  const trimmed = memo.content.trim();

  if (!trimmed) {
    return null;
  }

  const contentHash = hashText(memo.content);
  const row = {
    id: memo.id,
    user_id: session.user.id,
    content: memo.content,
    content_hash: contentHash,
    synced_content_hash: contentHash,
    sync_status: 'synced',
    indexed_content_hash: null,
    schedule_scanned_hash: null,
    schedule_scan_status: 'pending',
    topic_dirty: true,
    is_archived: false,
    created_at: memo.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('memos')
    .upsert(row, { onConflict: 'id' })
    .select('id, content, content_hash, is_archived, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data as MemoRow;
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
      'id, title, note, start_date, end_date, all_day, order, color, is_completed, created_at, updated_at',
    )
    .eq('user_id', session.user.id)
    .order('start_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CalendarBlockRow[];
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
        order: block.order ?? 0,
        color: block.color,
        is_completed: false,
      },
      { onConflict: 'id' },
    )
    .select(
      'id, title, note, start_date, end_date, all_day, order, color, is_completed, created_at, updated_at',
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
