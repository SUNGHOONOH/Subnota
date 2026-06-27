import { hashText, isUuid } from '../../../lib/contentHash';
import { CalendarBrick, useMemoStore } from '../../../store/useMemoStore';
import { isSupabaseConfigured, supabase } from '../../../shared/supabase/client';

export interface CalendarSyncResult {
  skippedReason?: 'not-configured' | 'signed-out';
  syncedCount: number;
}

const brickSyncHash = (brick: CalendarBrick) =>
  hashText(
    JSON.stringify({
      allDay: !brick.time,
      note: brick.note,
      order: brick.order,
      scheduledAt: brick.scheduledAt ?? null,
      time: brick.time ?? null,
      title: brick.title,
      tone: brick.tone,
    }),
  );

const toLocalCalendarDate = (value: number) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const needsSync = (brick: CalendarBrick) => {
  if (!isUuid(brick.id)) {
    return false;
  }

  if (brick.deletedAt) {
    return brick.syncStatus !== 'synced';
  }

  if (!brick.scheduledAt || !brick.title.trim()) {
    return false;
  }

  const syncedHash = brickSyncHash(brick);
  return brick.syncStatus !== 'synced' || brick.syncedHash !== syncedHash;
};

export const syncPendingCalendarBricks = async (
  bricks = useMemoStore.getState().calendarBricks,
): Promise<CalendarSyncResult> => {
  if (!isSupabaseConfigured()) {
    return { skippedReason: 'not-configured', syncedCount: 0 };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { skippedReason: 'signed-out', syncedCount: 0 };
  }

  const {
    markCalendarBrickSyncFailed,
    markCalendarBrickSynced,
    purgeCalendarBrick,
  } = useMemoStore.getState();
  const pendingBricks = bricks.filter(needsSync);
  let syncedCount = 0;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id' });

  if (profileError) {
    throw profileError;
  }

  for (const brick of pendingBricks) {
    try {
      if (brick.deletedAt) {
        const { error } = await supabase
          .from('calendar_blocks')
          .delete()
          .eq('id', brick.id)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        purgeCalendarBrick(brick.id);
        syncedCount += 1;
        continue;
      }

      const syncedHash = brickSyncHash(brick);
      const allDay = !brick.time;
      const scheduledAt = brick.scheduledAt ?? Date.now();
      const { error } = await supabase.from('calendar_blocks').upsert(
        {
          id: brick.id,
          user_id: user.id,
          title: brick.title,
          note: brick.note,
          start_date: new Date(scheduledAt).toISOString(),
          end_date: null,
          all_day: allDay,
          all_day_date: allDay ? toLocalCalendarDate(scheduledAt) : null,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          order: brick.order,
          color: brick.tone,
          is_completed: false,
          completed_at: null,
        },
        { onConflict: 'id' },
      );

      if (error) {
        throw error;
      }

      markCalendarBrickSynced(brick.id, syncedHash);
      syncedCount += 1;
    } catch {
      markCalendarBrickSyncFailed(brick.id);
    }
  }

  return { syncedCount };
};
