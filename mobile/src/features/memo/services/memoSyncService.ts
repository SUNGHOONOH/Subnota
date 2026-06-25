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
    applyRemoteMemo,
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

    try {
      // Optimistic-concurrency upsert keyed on the last-synced content hash.
      // On a concurrent edit the server keeps its version and preserves ours as
      // a conflict copy instead of letting this push blindly overwrite it.
      const { data, error } = await supabase.rpc('upsert_memo_if_base_hash', {
        p_id: memo.id,
        p_base_hash: memo.syncedContentHash ?? null,
        p_content: memo.content,
        p_content_hash: contentHash,
        p_category: memo.category,
        p_content_updated_at: new Date(memo.updatedAt).toISOString(),
        p_created_at: new Date(memo.createdAt).toISOString(),
      });

      if (error) {
        throw error;
      }

      const result = (Array.isArray(data) ? data[0] : data) as
        | { content: string | null; content_hash: string | null; status: string }
        | undefined;

      if (!result) {
        throw new Error('upsert_memo_if_base_hash returned no row');
      }

      if (result.status === 'conflict') {
        // Another device changed this memo first. Adopt the canonical version;
        // our edit is preserved server-side as a conflict copy.
        applyRemoteMemo(
          memo.id,
          result.content ?? memo.content,
          result.content_hash ?? contentHash,
          memo.category,
        );
      } else if (result.status === 'deleted') {
        // Deleted on another device (delete-wins). Stop re-pushing; this
        // push-only client keeps its local copy.
        markMemoSynced(memo.id, contentHash);
      } else {
        markMemoSynced(memo.id, result.content_hash ?? contentHash);
      }

      syncedCount += 1;
    } catch {
      markMemoSyncFailed(memo.id);
    }
  }

  return { syncedCount };
};
