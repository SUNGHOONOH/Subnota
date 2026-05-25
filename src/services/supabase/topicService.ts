import { isSupabaseConfigured, supabase } from './client';

export interface TopicCluster {
  confidence: number | null;
  id: string;
  keywords: string[];
  label: string;
  memoCount: number;
  representativeMemoIds: string[];
}

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

export interface TopicMembership {
  memoId: string;
  score: number | null;
  topicId: string;
}

interface TopicMemoEdgeRow {
  similarity: number;
  source_memo_id: string;
  target_memo_id: string;
  topic_id: string;
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

export const fetchTopicMap = async (): Promise<TopicMapData> => {
  if (!isSupabaseConfigured()) {
    return { clusters: [], edges: [], memberships: [] };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { clusters: [], edges: [], memberships: [] };
  }

  const { data: clusterData, error: clusterError } = await supabase
    .from('topic_clusters')
    .select(
      'id, label, keywords, representative_memo_ids, memo_count, confidence',
    )
    .eq('user_id', user.id)
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

  return {
    clusters: ((clusterData ?? []) as TopicClusterRow[]).map(row => ({
      confidence: row.confidence,
      id: row.id,
      keywords: row.keywords ?? [],
      label: row.label,
      memoCount: row.memo_count ?? 0,
      representativeMemoIds: row.representative_memo_ids ?? [],
    })),
    memberships: ((membershipData ?? []) as TopicMembershipRow[]).map(row => ({
      memoId: row.memo_id,
      score: row.score,
      topicId: row.topic_id,
    })),
    edges: (edgeData as TopicMemoEdgeRow[]).map(row => ({
      similarity: row.similarity,
      sourceMemoId: row.source_memo_id,
      targetMemoId: row.target_memo_id,
      topicId: row.topic_id,
    })),
  };
};
