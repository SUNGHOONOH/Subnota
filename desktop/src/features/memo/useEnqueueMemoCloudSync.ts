import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { getMemoCategory } from '../../lib/memoCategory';
import { rebaseEditorChangeOntoCanonical } from '../../lib/mergeMemo';
import {
  applyLocalMemoSyncResult,
  createLocalMemoRow,
  getLocalMemo,
  markLocalMemoDeleted,
  preserveLocalMemoRecovery,
  upsertLocalMemo,
} from '../../services/local/offlineStore';
import { pushMemoMerging } from '../../services/supabase/memoSync';
import type { MemoRow } from '../../types';
import {
  memoCloudSyncInput,
  type MemoCloudSyncInput,
} from './memoCloudSync';

interface UseEnqueueMemoCloudSyncOptions {
  activeMemoIdRef: MutableRefObject<string | null>;
  cancelMemoCloudRetry: (memoId: string) => void;
  deletingMemoIdsRef: MutableRefObject<Set<string>>;
  isCurrentSession: (expectedSession: Session) => boolean;
  memoSyncChainsRef: MutableRefObject<Map<string, Promise<void>>>;
  memoSyncRevisionsRef: MutableRefObject<Map<string, number>>;
  memosRef: MutableRefObject<MemoRow[]>;
  pendingLocalMemoWritePromisesRef: MutableRefObject<Map<string, Promise<void>>>;
  scheduleMemoCloudRetry: (
    currentSession: Session,
    memo: MemoCloudSyncInput,
  ) => void;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMemos: Dispatch<SetStateAction<MemoRow[]>>;
  t: (korean: string, english: string) => string;
}

export const useEnqueueMemoCloudSync = ({
  activeMemoIdRef,
  cancelMemoCloudRetry,
  deletingMemoIdsRef,
  isCurrentSession,
  memoSyncChainsRef,
  memoSyncRevisionsRef,
  memosRef,
  pendingLocalMemoWritePromisesRef,
  scheduleMemoCloudRetry,
  setActiveMemoCreatedAt,
  setError,
  setMemos,
  t,
}: UseEnqueueMemoCloudSyncOptions) => {
  const enqueueMemoCloudSync = useCallback(
    (
      currentSession: Session,
      memo: MemoCloudSyncInput,
      revision: number,
    ) => {
    const previousSync =
      memoSyncChainsRef.current.get(memo.id) ?? Promise.resolve();
    const sync = previousSync
      .catch(() => undefined)
      .then(async () => {
        if (!isCurrentSession(currentSession)) {
          return;
        }
        if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
          return;
        }
        const latestMemoAtPush = memosRef.current.find(
          (item) => item.id === memo.id,
        );
        const memoToPush = latestMemoAtPush
          ? memoCloudSyncInput(latestMemoAtPush)
          : memo;
        try {
          // Resolve the concurrency base at push time from the local DB: the
          // values captured when this sync was scheduled can already be stale
          // (an earlier push may have acked while the user kept typing).
          const localRow = await getLocalMemo(
            memoToPush.id,
            currentSession.user.id,
          );
          const result = await pushMemoMerging(currentSession, {
            ...memoToPush,
            baseContent:
              localRow?.synced_content ??
              (localRow?.local_sync_status === 'synced'
                ? localRow.content
                : null),
            baseHash:
              localRow?.synced_content_hash ?? memoToPush.baseHash ?? null,
          });
          if (!isCurrentSession(currentSession)) {
            return;
          }

          if (result.status === 'deleted') {
            if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
              return;
            }
            // Deleted on another device (delete-wins): drop it locally.
            cancelMemoCloudRetry(memo.id);
            await markLocalMemoDeleted(
              memo.id,
              'synced',
              currentSession.user.id,
            );
            if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
              return;
            }
            setMemos((previous) =>
              previous.filter((item) => item.id !== memo.id),
            );
            return;
          }

          // savedMemo is the server-acked canonical version: ours, the 3-way
          // merge, or the newest side of an unmergeable conflict. The losing
          // side is kept in hidden local recovery history, never as a new note.
          const savedMemo = result.memo;

          // The live Tiptap document is deliberately not replaced here: doing
          // that broke Korean IME composition and selection. Instead, rebase
          // any input made while the request was in flight onto the canonical
          // server result, then advance content and sync base as one SQLite
          // compare-and-apply operation.
          const pendingLocalWrite =
            pendingLocalMemoWritePromisesRef.current.get(memo.id);
          if (pendingLocalWrite) {
            try {
              await pendingLocalWrite;
            } catch {
              // Do not overwrite a local value whose durable write failed. A
              // later retry will push it against the still-old base safely.
              return;
            }
          }
          if (!isCurrentSession(currentSession)) return;

          const currentMemo = memosRef.current.find(
            (item) => item.id === memo.id,
          );
          if (!currentMemo || deletingMemoIdsRef.current.has(memo.id)) return;
          const hasNewerLocalEdit =
            memoSyncRevisionsRef.current.get(memo.id) !== revision ||
            currentMemo.content !== memoToPush.content;
          const rebased = hasNewerLocalEdit
            ? rebaseEditorChangeOntoCanonical(
                memoToPush.content,
                currentMemo.content,
                savedMemo.content,
              )
            : { ok: true, text: savedMemo.content };
          if (!rebased.ok) {
            await preserveLocalMemoRecovery(
              {
                content: savedMemo.content,
                memoId: memo.id,
                source: 'server',
                sourceUpdatedAt:
                  savedMemo.content_updated_at ?? savedMemo.updated_at,
              },
              currentSession.user.id,
            );
            setError(
              t(
                '동기화된 변경과 편집 중 입력을 자동 병합하지 못해 복구 기록을 보관했습니다.',
                'We could not merge synced changes with your edits, so a recovery copy was kept.',
              ),
            );
            return;
          }

          const acknowledgedHash =
            savedMemo.synced_content_hash ?? savedMemo.content_hash;
          const canonicalMemo = createLocalMemoRow(
            {
              category: hasNewerLocalEdit
                ? getMemoCategory(currentMemo.category)
                : getMemoCategory(savedMemo.category),
              content: rebased.text,
              content_updated_at: hasNewerLocalEdit
                ? (currentMemo.content_updated_at ?? currentMemo.updated_at)
                : (savedMemo.content_updated_at ?? savedMemo.updated_at),
              created_at: currentMemo.created_at,
              id: savedMemo.id,
              synced_content: savedMemo.content,
              synced_content_hash: acknowledgedHash,
              updated_at: hasNewerLocalEdit
                ? currentMemo.updated_at
                : savedMemo.updated_at,
            },
            hasNewerLocalEdit ? 'pending' : 'synced',
          );
          const installCanonicalIfCurrent = (items: MemoRow[]) => {
            if (
              !items.some(
                (item) =>
                  item.id === memo.id && item.content === currentMemo.content,
              )
            ) {
              return items;
            }
            return items.map((item) =>
              item.id === memo.id && item.content === currentMemo.content
                ? canonicalMemo
                : item,
            );
          };

          // Move the renderer's canonical snapshot synchronously before the
          // IPC await. A keystroke during that await is then rebased by
          // saveMemoContent without ever mutating the Tiptap document itself.
          memosRef.current = installCanonicalIfCurrent(memosRef.current);
          setMemos(installCanonicalIfCurrent);
          const applied = await applyLocalMemoSyncResult(
            canonicalMemo,
            currentMemo.content,
            currentSession.user.id,
          );
          if (!applied || !isCurrentSession(currentSession)) return;
          if (!hasNewerLocalEdit) {
            cancelMemoCloudRetry(memo.id);
          }

          if (activeMemoIdRef.current === memo.id) {
            setActiveMemoCreatedAt(savedMemo.created_at);
          }
        } catch (error) {
          if (
            isCurrentSession(currentSession) &&
            memoSyncRevisionsRef.current.get(memo.id) === revision
          ) {
            try {
              // Preserve the last-acked sync base — nulling it here would make
              // the retry push read as a cross-device conflict.
              const failedRow = await getLocalMemo(
                memo.id,
                currentSession.user.id,
              );
              await upsertLocalMemo(
                {
                  category: memoToPush.category,
                  content: memoToPush.content,
                  content_updated_at: memoToPush.contentUpdatedAt,
                  created_at: memoToPush.createdAt,
                  id: memoToPush.id,
                  synced_content: failedRow?.synced_content ?? null,
                  synced_content_hash: failedRow?.synced_content_hash ?? null,
                },
                'failed',
                currentSession.user.id,
              );
              setMemos((previous) =>
                previous.map((item) =>
                  item.id === memo.id
                    ? { ...item, local_sync_status: 'failed' }
                    : item,
                ),
              );
              console.warn('Memo cloud sync failed; retry scheduled.', error);
              scheduleMemoCloudRetry(currentSession, memoToPush);
            } catch {
              // Keep the original local write; it remains retryable as pending.
            }
          }
        }
      });

    memoSyncChainsRef.current.set(memo.id, sync);
    void sync.finally(() => {
      if (memoSyncChainsRef.current.get(memo.id) === sync) {
        memoSyncChainsRef.current.delete(memo.id);
      }
    });
      return sync;
    },
    [cancelMemoCloudRetry, isCurrentSession, scheduleMemoCloudRetry],
  );

  return { enqueueMemoCloudSync };
};
