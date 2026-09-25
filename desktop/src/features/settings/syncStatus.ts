type SyncStatusRecord = object;

const readSyncStatus = (item: SyncStatusRecord) => {
  const value = (item as { local_sync_status?: unknown }).local_sync_status;
  return typeof value === 'string' ? value : null;
};

export const countPendingSync = ({
  calendarBlocks,
  inboxItems,
  memos,
}: {
  calendarBlocks: readonly SyncStatusRecord[];
  inboxItems: readonly SyncStatusRecord[];
  memos: readonly SyncStatusRecord[];
}) =>
  memos.filter((item) => readSyncStatus(item)?.startsWith('pending')).length +
  calendarBlocks.filter((item) =>
    readSyncStatus(item)?.startsWith('pending'),
  ).length +
  inboxItems.filter((item) => readSyncStatus(item) === 'pending').length;

export const countFailedSync = ({
  calendarBlocks,
  inboxItems,
  memos,
}: {
  calendarBlocks: readonly SyncStatusRecord[];
  inboxItems: readonly SyncStatusRecord[];
  memos: readonly SyncStatusRecord[];
}) =>
  memos.filter((item) => readSyncStatus(item) === 'failed').length +
  calendarBlocks.filter((item) => readSyncStatus(item) === 'failed').length +
  inboxItems.filter((item) => readSyncStatus(item) === 'failed').length;
