import { isSupabaseConfigured, supabase } from '../../../shared/supabase/client';

export interface DailyBriefing {
  briefingDate: string | null;
  content: string;
  createdAt: number;
  id: string;
  metadata: Record<string, unknown>;
}

interface DailyBriefingRow {
  briefing_date: string | null;
  content: string;
  created_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
}

const mapBriefingRow = (row: DailyBriefingRow): DailyBriefing => ({
  briefingDate: row.briefing_date,
  content: row.content,
  createdAt: new Date(row.created_at).getTime(),
  id: row.id,
  metadata: row.metadata ?? {},
});

export const fetchDailyBriefings = async (
  limit = 20,
): Promise<DailyBriefing[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('briefings')
    .select('id, content, type, briefing_date, metadata, created_at')
    .eq('user_id', user.id)
    .eq('type', 'daily')
    .order('briefing_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as DailyBriefingRow[]).map(mapBriefingRow);
};
