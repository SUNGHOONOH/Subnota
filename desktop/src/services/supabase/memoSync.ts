import { Session } from '@supabase/supabase-js';

import { mergeMemoContent } from '../../lib/mergeMemo';
import { MemoRow } from '../../types';
import { preserveLocalMemoRecovery } from '../local/offlineStore';
import { fetchMemoById, upsertMemo } from './data';

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
  | { memo: MemoRow; merged: boolean; status: 'synced' }
  | { memo: null; merged: false; status: 'deleted' };

const timestamp = (value: string | null | undefined) => {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveUnmergeableConflict = async (
  session: Session,
  memo: MemoPushInput,
  server: MemoRow,
): Promise<MemoPushResult> => {
  const localIsLatest =
    timestamp(memo.contentUpdatedAt) >=
    timestamp(server.content_updated_at ?? server.updated_at);

  if (!localIsLatest) {
    // Keep the losing local text in hidden recovery history. It remains
    // recoverable without becoming another note in the user's sidebar.
    await preserveLocalMemoRecovery(
      {
        content: memo.content,
        memoId: memo.id,
        source: 'local',
        sourceUpdatedAt: memo.contentUpdatedAt,
      },
      session.user.id,
    );
    return { memo: server, merged: false, status: 'synced' };
  }

  // The active local edit is newer. Preserve the server version first, then
  // replace it using the just-read hash. If the server moves again, fail and
  // retry later instead of either reverting the UI or creating another note.
  await preserveLocalMemoRecovery(
    {
      content: server.content,
      memoId: memo.id,
      source: 'server',
      sourceUpdatedAt: server.content_updated_at ?? server.updated_at,
    },
    session.user.id,
  );
  const retry = await upsertMemo(session, {
    ...memo,
    baseHash: server.content_hash,
  });
  if (retry.status === 'deleted') {
    return { memo: null, merged: false, status: 'deleted' };
  }
  if (retry.status === 'conflict') {
    throw new Error('Memo changed again while resolving a conflict.');
  }
  return { memo: retry.memo, merged: false, status: 'synced' };
};

// Merge concurrent edits first. If the edits cannot be merged, keep the losing
// version in local recovery history and show the newest version under the
// original memo id. Conflict handling must never create visible duplicate notes.
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

  let server = await fetchMemoById(session, memo.id);
  if (memo.baseContent != null) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const merged = mergeMemoContent(
        memo.baseContent,
        memo.content,
        server.content,
      );
      if (!merged.ok) break;
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
      server = await fetchMemoById(session, memo.id);
    }
  }

  return resolveUnmergeableConflict(session, memo, server);
};
