import type { MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { InboxSession } from '../../services/backend/inboxService';
import {
  flushPendingLocalGrowthWrites,
  loadLocalActivityCompletions,
  loadLocalDailyCompletions,
  loadLocalScheduleInboxActions,
  removeLocalScheduleInboxAction,
  upsertLocalActivityCompletion,
  upsertLocalDailyCompletion,
} from '../../services/local/offlineStore';
import {
  recordActivityCompletion,
  recordDailyCompletion,
  updateScheduleInboxStatus,
} from '../../services/supabase/data';
import type { KeyedMutationQueue } from '../../lib/keyedMutationQueue';
import { syncPendingCalendarBlocks } from '../calendar/syncPendingCalendarBlocks';
import { syncPendingInboxItems } from '../inbox/syncPendingInboxItems';
import { syncPendingMemoFolders } from '../memo/syncPendingMemoFolders';
import { syncPendingMemoRows } from '../memo/syncPendingMemoRows';
import type { MemoCloudSyncInput } from '../memo/memoCloudSync';

interface SyncPendingLocalWorkspaceOptions {
  cancelMemoCloudSync: (memoId: string) => Promise<void>;
  calendarMutationQueueRef: MutableRefObject<KeyedMutationQueue>;
  currentSession: Session;
  deletedPendingInboxClientIdsRef: MutableRefObject<Set<string>>;
  discardDeletedPendingInboxItem: (
    currentSession: Session,
    item: InboxSession,
    clientId: string,
    ownerId: string,
  ) => Promise<void>;
  inboxServerIdsByClientIdRef: MutableRefObject<Map<string, string>>;
  memoSyncTimersRef: MutableRefObject<Map<string, number>>;
  pendingInboxDeleteIdsRef: MutableRefObject<Set<string>>;
  pendingLocalMemoWriteOwnersRef: MutableRefObject<Map<string, string | null>>;
  syncMemoToCloudNow: (
    currentSession: Session,
    memo: MemoCloudSyncInput,
  ) => Promise<void>;
}

/**
 * Drains every local-first outbox after a session becomes available. Each
 * domain keeps its existing ordering and failure isolation; this function only
 * coordinates the established boundaries from one workspace sync entrypoint.
 */
export const syncPendingLocalWorkspace = async ({
  cancelMemoCloudSync,
  calendarMutationQueueRef,
  currentSession,
  deletedPendingInboxClientIdsRef,
  discardDeletedPendingInboxItem,
  inboxServerIdsByClientIdRef,
  memoSyncTimersRef,
  pendingInboxDeleteIdsRef,
  pendingLocalMemoWriteOwnersRef,
  syncMemoToCloudNow,
}: SyncPendingLocalWorkspaceOptions) => {
  const ownerId = currentSession.user.id;

  await flushPendingLocalGrowthWrites().catch(() => undefined);

  for (const completion of await loadLocalActivityCompletions(ownerId)) {
    if (
      !completion.local_sync_status ||
      completion.local_sync_status === 'synced'
    ) {
      continue;
    }
    try {
      await recordActivityCompletion(currentSession, completion);
      await upsertLocalActivityCompletion(completion, 'synced', ownerId);
    } catch {
      // Keep the append-only completion pending for the next reconnect.
    }
  }
  for (const completion of await loadLocalDailyCompletions(ownerId)) {
    if (
      !completion.local_sync_status ||
      completion.local_sync_status === 'synced'
    ) {
      continue;
    }
    try {
      await recordDailyCompletion(currentSession, completion);
      await upsertLocalDailyCompletion(completion, 'synced', ownerId);
    } catch {
      // Keep the append-only completion pending for the next reconnect.
    }
  }

  await syncPendingMemoRows({
    cancelMemoCloudSync,
    currentSession,
    memoSyncTimersRef,
    pendingLocalMemoWriteOwnersRef,
    syncMemoToCloudNow,
  });

  await syncPendingCalendarBlocks(
    currentSession,
    ownerId,
    calendarMutationQueueRef,
  );

  await syncPendingMemoFolders(currentSession, ownerId);

  // Schedule inbox actions are local-first: the candidate is removed from
  // the UI immediately, then this outbox retries the server status update
  // on the next sync if the first attempt was offline or failed.
  for (const action of await loadLocalScheduleInboxActions(ownerId)) {
    try {
      await updateScheduleInboxStatus(
        currentSession,
        action.id,
        action.status,
      );
      await removeLocalScheduleInboxAction(action.id, ownerId);
    } catch {
      // Keep the action queued for the next reconnect or app start.
    }
  }

  await syncPendingInboxItems({
    currentSession,
    deletedPendingInboxClientIdsRef,
    discardDeletedPendingInboxItem,
    inboxServerIdsByClientIdRef,
    ownerId,
    pendingInboxDeleteIdsRef,
  });
};
