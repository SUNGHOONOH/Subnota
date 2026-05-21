import { hashText } from '../../lib/contentHash';
import { Memo, useMemoStore } from '../../store/useMemoStore';
import { isSupabaseConfigured, supabase } from './client';

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

  const { markMemoSynced, markMemoSyncFailed } = useMemoStore.getState();
  const pendingMemos = memos.filter(needsSync);
  let syncedCount = 0;

  await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });

  for (const memo of pendingMemos) {
    const contentHash = memo.contentHash ?? hashText(memo.content);

    try {
      const { error } = await supabase.from('memos').upsert(
        {
          id: memo.id,
          user_id: user.id,
          content: memo.content,
          content_hash: contentHash,
          synced_content_hash: contentHash,
          sync_status: 'synced',
          is_archived: Boolean(memo.deletedAt),
          created_at: new Date(memo.createdAt).toISOString(),
          updated_at: new Date(memo.updatedAt).toISOString(),
        },
        { onConflict: 'id' },
      );

      if (error) {
        throw error;
      }

      markMemoSynced(memo.id, contentHash);
      syncedCount += 1;
    } catch (_error) {
      markMemoSyncFailed(memo.id);
    }
  }

  return { syncedCount };
};
