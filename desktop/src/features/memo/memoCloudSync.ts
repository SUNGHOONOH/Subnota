import { getMemoCategory } from '../../lib/memoCategory';
import type { MemoRow } from '../../types';

export type MemoCloudSyncInput = {
  baseHash?: string | null;
  category: string;
  content: string;
  contentUpdatedAt: string;
  createdAt: string;
  id: string;
};

export const memoCloudSyncInput = (memo: MemoRow): MemoCloudSyncInput => ({
  baseHash: memo.synced_content_hash ?? null,
  category: getMemoCategory(memo.category),
  content: memo.content,
  contentUpdatedAt: memo.content_updated_at ?? memo.updated_at,
  createdAt: memo.created_at,
  id: memo.id,
});
