export interface MemoRow {
  category?: string | null;
  content: string;
  content_hash: string | null;
  content_updated_at?: string | null;
  created_at: string;
  id: string;
  is_archived: boolean | null;
  local_sync_status?: 'failed' | 'pending' | 'pending_delete' | 'synced';
  // Server content as of the last successful sync/pull — the shared base for
  // 3-way conflict merges.
  synced_content?: string | null;
  // Server content_hash as of the last successful sync/pull. Used as the
  // optimistic-concurrency base when pushing edits (see upsert_memo_if_base_hash).
  synced_content_hash?: string | null;
  updated_at: string;
}

export type MemoSaveState =
  | 'failed'
  | 'idle'
  | 'local'
  | 'local-failed'
  | 'saving-local'
  | 'synced'
  | 'syncing';

export interface CalendarBlockRow {
  all_day: boolean | null;
  all_day_date?: string | null;
  color: string | null;
  completed_at: string | null;
  created_at: string;
  end_date: string | null;
  id: string;
  is_completed: boolean | null;
  local_sync_status?: 'failed' | 'pending' | 'pending_delete' | 'synced';
  note: string | null;
  order: number | null;
  start_date: string;
  title: string;
  time_zone?: string | null;
  updated_at: string;
}

export interface ScheduleInboxRow {
  all_day: boolean | null;
  confidence: 'auto' | 'candidate' | null;
  created_at: string;
  id: string;
  memo_id: string;
  scheduled_at: string;
  source_text: string;
  status: 'pending' | 'accepted' | 'dismissed';
  time_text: string | null;
  title: string;
}

export interface BriefingRow {
  briefing_date: string | null;
  content: string;
  created_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
  type: 'daily' | 'weekly';
}

export interface TopicCluster {
  confidence: number | null;
  id: string;
  keywords: string[];
  label: string;
  memoCount: number;
  representativeMemoIds: string[];
}

export interface TopicMembership {
  memoId: string;
  score: number | null;
  topicId: string;
}

// Saved web-inbox summaries attached to a topic centroid (State A decoration).
export interface TopicInboxMembership {
  inboxSessionId: string;
  score: number | null;
  topicId: string;
}

export interface TopicMemoInboxEdge {
  inboxSessionId: string;
  memoId: string;
  similarity: number;
  topicId: string;
}

export interface TopicMemoEdge {
  similarity: number;
  sourceMemoId: string;
  targetMemoId: string;
  topicId: string;
}

export interface MemoSimilarityEdge {
  similarity: number;
  sourceMemoId: string;
  sourceTopicId: string | null;
  targetMemoId: string;
  targetTopicId: string | null;
}

export interface TopicMapData {
  clusters: TopicCluster[];
  edges: TopicMemoEdge[];
  globalEdges: MemoSimilarityEdge[];
  inboxEdges: TopicMemoInboxEdge[];
  inboxMemberships: TopicInboxMembership[];
  memberships: TopicMembership[];
}

export type TabKey = 'memo' | 'calendar' | 'inbox' | 'briefing';
