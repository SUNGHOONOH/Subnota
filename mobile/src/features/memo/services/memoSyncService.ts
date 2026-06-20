import { hashText } from '../../../lib/contentHash';
import { Memo, useMemoStore } from '../../../store/useMemoStore';
import { isSupabaseConfigured, supabase } from '../../../shared/supabase/client';

export interface MemoSyncResult {
  skippedReason?: 'not-configured' | 'signed-out';
  syncedCount: number;
}

const needsSync = (memo: Memo) => {
  if (!memo.content.trim()) {
    return false;
  }

  const contentHash = memo.contentHash ?? hashText(memo.content);
  return memo.syncStatus !== 'synced' || memo.syncedContentHash !== contentHash;
};

export const syncPendingMemos = async (
  memos = useMemoStore.getState().memos,
): Promise<MemoSyncResult> => {
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
    deletedMemoIds,
    markMemoDeletedSynced,
    markMemoSynced,
    markMemoSyncFailed,
  } = useMemoStore.getState();
  const pendingMemos = memos.filter(needsSync);
  let syncedCount = 0;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id' });

  if (profileError) {
    throw profileError;
  }

  for (const memoId of deletedMemoIds) {
    try {
      const { error } = await supabase
        .from('memos')
        .delete()
        .eq('id', memoId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      markMemoDeletedSynced(memoId);
      syncedCount += 1;
    } catch {
      markMemoSyncFailed(memoId);
    }
  }

  for (const memo of pendingMemos) {
    const contentHash = memo.contentHash ?? hashText(memo.content);
    const contentChanged = memo.syncedContentHash !== contentHash;
    const memoRow = {
      id: memo.id,
      user_id: user.id,
      content: memo.content,
      category: memo.category,
      content_hash: contentHash,
      synced_content_hash: contentHash,
      sync_status: 'synced',
      is_archived: Boolean(memo.deletedAt),
      created_at: new Date(memo.createdAt).toISOString(),
      updated_at: new Date(memo.updatedAt).toISOString(),
      ...(contentChanged
        ? {
            indexed_content_hash: null,
            schedule_scanned_hash: null,
            schedule_scan_status: 'pending',
            topic_dirty: true,
          }
        : {}),
    };

    try {
      const { error } = await supabase
        .from('memos')
        .upsert(memoRow, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      markMemoSynced(memo.id, contentHash);
      syncedCount += 1;
    } catch {
      markMemoSyncFailed(memo.id);
    }
  }

  return { syncedCount };
};
