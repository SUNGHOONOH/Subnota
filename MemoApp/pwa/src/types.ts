export interface MemoRow {
  content: string;
  content_hash: string | null;
  created_at: string;
  id: string;
  is_archived: boolean | null;
  updated_at: string;
}

export interface CalendarBlockRow {
  all_day: boolean | null;
  color: string | null;
  created_at: string;
  end_date: string | null;
  id: string;
  is_completed: boolean | null;
  note: string | null;
  order: number | null;
  start_date: string;
  title: string;
  updated_at: string;
}

export interface ScheduleInboxRow {
  all_day: boolean | null;
  confidence: 'auto' | 'candidate' | null;
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

export interface TopicMemoEdge {
  similarity: number;
  sourceMemoId: string;
  targetMemoId: string;
  topicId: string;
}

export interface TopicMapData {
  clusters: TopicCluster[];
  edges: TopicMemoEdge[];
  memberships: TopicMembership[];
}

export type TabKey = 'memo' | 'calendar' | 'inbox' | 'briefing';
