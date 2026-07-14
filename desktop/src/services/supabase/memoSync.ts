import { Session } from '@supabase/supabase-js';

import { mergeMemoContent } from '../../lib/mergeMemo';
import { MemoRow } from '../../types';
import { upsertMemo } from './data';

export interface MemoPushInput {
  baseContent?: string | null;
  baseHash?: string | null;
  category?: string | null;
  content: string;
  contentUpdatedAt?: string;
  createdAt?: string;
  id: string;
}

export type MemoPushResult =
  | { memo: MemoRow; merged: boolean; status: 'conflict-copy' | 'synced' }
  | { memo: null; merged: false; status: 'deleted' };

// Conflict policy (Obsidian Sync's default, per 2026-07 review): 3-way merge
// the server's changes since the shared base into our text and re-push. Only
// when merging is impossible — no base content, overlapping edits, or the
// server moving again mid-flight — does the server preserve our version as a
// conflict copy. Duplicate notes become the exception, not the default.
export const pushMemoMerging = async (
  session: Session,
  memo: MemoPushInput,
): Promise<MemoPushResult> => {
  const first = await upsertMemo(session, memo);
  if (first.status === 'deleted') {
    return { memo: null, merged: false, status: 'deleted' };
  }
  if (first.status !== 'conflict') {
    return { memo: first.memo, merged: false, status: 'synced' };
  }

  const server = first.memo;
  if (memo.baseContent != null) {
    const merged = mergeMemoContent(memo.baseContent, memo.content, server.content);
    if (merged.ok) {
      const retry = await upsertMemo(session, {
        ...memo,
        baseHash: server.content_hash,
        content: merged.text,
      });
      if (retry.status === 'deleted') {
        return { memo: null, merged: false, status: 'deleted' };
      }
      if (retry.status !== 'conflict') {
        return { memo: retry.memo, merged: true, status: 'synced' };
      }
      // The server changed again between our two calls; fall through.
    }
  }

  const fallback = await upsertMemo(session, memo, { preserveConflictCopy: true });
  if (fallback.status === 'deleted') {
    return { memo: null, merged: false, status: 'deleted' };
  }
  return { memo: fallback.memo, merged: false, status: 'conflict-copy' };
};
