import { isSupabaseConfigured, supabase } from '../../../shared/supabase/client';

export type ScheduleInboxStatus = 'pending' | 'accepted' | 'dismissed';

export interface ScheduleInboxItem {
  id: string;
  memoId: string;
  title: string;
  sourceText: string;
  scheduledAt: number;
  timeText: string | null;
  allDay: boolean;
  confidence: 'auto' | 'candidate';
}

interface ScheduleInboxRow {
  id: string;
  memo_id: string;
  title: string;
  source_text: string;
  scheduled_at: string;
  time_text: string | null;
  all_day: boolean | null;
  confidence: 'auto' | 'candidate' | null;
}

export const fetchPendingScheduleInbox = async (): Promise<
  ScheduleInboxItem[]
> => {
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
    .from('schedule_inbox')
    .select(
      'id, memo_id, title, source_text, scheduled_at, time_text, all_day, confidence',
    )
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(30);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ScheduleInboxRow[]).map(row => ({
    id: row.id,
    memoId: row.memo_id,
    title: row.title,
    sourceText: row.source_text,
    scheduledAt: new Date(row.scheduled_at).getTime(),
    timeText: row.time_text,
    allDay: Boolean(row.all_day),
    confidence: row.confidence ?? 'candidate',
  }));
};

export const updateScheduleInboxStatus = async (
  id: string,
  status: ScheduleInboxStatus,
) => {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase
    .from('schedule_inbox')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw error;
  }
};
