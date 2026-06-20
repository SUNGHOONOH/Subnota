import { syncPendingCalendarBricks } from '../../features/calendar/services/calendarSyncService';
import { syncPendingInboxSessions } from '../../features/inbox/services/inboxSyncService';
import { syncPendingMemos } from '../../features/memo/services/memoSyncService';

let lastSyncAttemptAt = 0;
let inFlightSync: Promise<void> | null = null;

export const syncLocalData = async (
  options: { force?: boolean } = {},
): Promise<void> => {
  const now = Date.now();

  if (!options.force && now - lastSyncAttemptAt < 15000) {
    return;
  }

  if (inFlightSync) {
    if (options.force) {
      return inFlightSync.then(() => syncLocalData({ force: true }));
    }

    return inFlightSync;
  }

  lastSyncAttemptAt = now;
  inFlightSync = Promise.all([
    syncPendingMemos(),
    syncPendingCalendarBricks(),
    syncPendingInboxSessions(),
  ])
    .then(() => undefined)
    .finally(() => {
      inFlightSync = null;
    });

  return inFlightSync;
};
