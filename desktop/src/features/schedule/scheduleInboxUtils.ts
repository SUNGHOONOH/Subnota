import type { ScheduleInboxRow } from '../../types';
import { toValidDate } from '../../lib/viewCrashGuards';

type LocalScheduleInboxRow = ScheduleInboxRow & {
  local_sync_status?: 'failed' | 'pending' | 'pending_delete' | 'synced';
};

export const hasScheduledTime = (item: ScheduleInboxRow) =>
  !item.all_day && item.time_text !== null;

export const hasScheduledDate = (item: ScheduleInboxRow) =>
  Boolean(toValidDate(item.scheduled_at));

export const requiresSchedulePicker = (item: ScheduleInboxRow) =>
  !hasScheduledDate(item) || !hasScheduledTime(item);

export const partitionScheduleInbox = (items: ScheduleInboxRow[]) => ({
  calendarSuggestions: items.filter(hasScheduledDate),
  inboxItems: items.filter(item => !hasScheduledDate(item)),
});

export const mergePendingScheduleInbox = (
  remoteItems: ScheduleInboxRow[],
  localItems: LocalScheduleInboxRow[],
  handledIds: ReadonlySet<string> = new Set(),
) => {
  const remoteIds = new Set(remoteItems.map(item => item.id));
  const pendingLocalItems = localItems.filter(
    item =>
      (item.local_sync_status === 'pending' ||
        item.local_sync_status === 'failed') &&
      !handledIds.has(item.id) &&
      !remoteIds.has(item.id),
  );

  return [...remoteItems, ...pendingLocalItems];
};
