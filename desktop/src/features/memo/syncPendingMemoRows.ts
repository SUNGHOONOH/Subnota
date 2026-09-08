import type { MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getMemoCategory } from '../../lib/memoCategory';
import {
  pendingMemoIdsForOwner,
  shouldDeferMemoSync,
} from '../../lib/memoLoadMerge';
import {
  markLocalMemoDeleted,
  loadLocalMemos,
} from '../../services/local/offlineStore';
import { archiveMemo as archiveMemoOnCloud } from '../../services/supabase/data';
import type { MemoCloudSyncInput } from './memoCloudSync';

interface SyncPendingMemoRowsOptions {
  cancelMemoCloudSync: (memoId: string) => Promise<void>;
  currentSession: Session;
  memoSyncTimersRef: MutableRefObject<Map<string, number>>;
  pendingLocalMemoWriteOwnersRef: MutableRefObject<Map<string, string | null>>;
  syncMemoToCloudNow: (
    currentSession: Session,
    memo: MemoCloudSyncInput,
  ) => Promise<void>;
}

export const syncPendingMemoRows = async ({
  cancelMemoCloudSync,
  currentSession,
  memoSyncTimersRef,
  pendingLocalMemoWriteOwnersRef,
  syncMemoToCloudNow,
}: SyncPendingMemoRowsOptions) => {
  const ownerId = currentSession.user.id;

  for (const memo of await loadLocalMemos(ownerId)) {
    try {
      if (memo.local_sync_status === 'pending_delete') {
        await cancelMemoCloudSync(memo.id);
        await archiveMemoOnCloud(currentSession, memo.id);
        await markLocalMemoDeleted(memo.id, 'synced', ownerId);
        continue;
      }

      // A scheduled debounce sync means this memo is being edited right now and
      // our DB snapshot may already be stale. Pushing it would cancel the fresher
      // pending sync and write the stale server echo back over the local row
      // (typed text silently reverts on restart). Let the debounce push instead.
      if (
        shouldDeferMemoSync(
          memo.id,
          pendingMemoIdsForOwner(
            pendingLocalMemoWriteOwnersRef.current,
            ownerId,
          ),
          memoSyncTimersRef.current,
        )
      ) {
        continue;
      }

      if (memo.local_sync_status && memo.local_sync_status !== 'synced') {
        await syncMemoToCloudNow(currentSession, {
          baseHash: memo.synced_content_hash ?? null,
          category: getMemoCategory(memo.category),
          content: memo.content,
          contentUpdatedAt: memo.content_updated_at ?? memo.updated_at,
          createdAt: memo.created_at,
          id: memo.id,
        });
      }
    } catch (error) {
      // One unreachable row must not starve calendar, inbox, or the remote
      // refresh. Its pending/failed local record remains retryable.
      console.warn('Pending memo sync failed; keeping it for retry.', error);
    }
  }
};
