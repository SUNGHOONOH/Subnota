import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getMemoCategory } from '../../lib/memoCategory';
import {
  markLocalMemoDeleted,
} from '../../services/local/offlineStore';
import { archiveMemo } from '../../services/supabase/data';
import type { MemoRow, MemoSaveState } from '../../types';

interface UseDeleteMemoOptions {
  activeMemoId: string | null;
  cancelMemoCloudSync: (memoId: string) => Promise<void>;
  deletingMemoIdsRef: MutableRefObject<Set<string>>;
  memoLocalWriteRevisionsRef: MutableRefObject<Map<string, number>>;
  memos: MemoRow[];
  memosRef: MutableRefObject<MemoRow[]>;
  session: Session | null;
  setActiveDraftCategory: Dispatch<SetStateAction<string>>;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setActiveMemoId: Dispatch<SetStateAction<string | null>>;
  setManualMemoSyncRetryIds: Dispatch<SetStateAction<string[]>>;
  setMemoSaveStates: Dispatch<SetStateAction<Record<string, MemoSaveState>>>;
  setMemos: Dispatch<SetStateAction<MemoRow[]>>;
  t: (korean: string, english: string) => string;
}

export const useDeleteMemo = ({
  activeMemoId,
  cancelMemoCloudSync,
  deletingMemoIdsRef,
  memoLocalWriteRevisionsRef,
  memos,
  memosRef,
  session,
  setActiveDraftCategory,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setManualMemoSyncRetryIds,
  setMemoSaveStates,
  setMemos,
  t,
}: UseDeleteMemoOptions) => {
  const deleteMemoById = async (id: string) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existingMemo = memosRef.current.find((memo) => memo.id === id);

    deletingMemoIdsRef.current.add(id);
    setManualMemoSyncRetryIds((previous) =>
      previous.filter((memoId) => memoId !== id),
    );
    memoLocalWriteRevisionsRef.current.set(
      id,
      (memoLocalWriteRevisionsRef.current.get(id) ?? 0) + 1,
    );
    setMemos((previous) => previous.filter((memo) => memo.id !== id));

    if (id === activeMemoId) {
      const nextMemos = memos.filter((memo) => memo.id !== id);
      const nextActive = nextMemos[0] ?? null;
      setActiveMemoId(nextActive?.id ?? null);
      setActiveMemoCreatedAt(
        nextActive?.created_at ?? new Date().toISOString(),
      );
      setActiveDraftCategory(getMemoCategory(nextActive?.category));
    }

    try {
      await markLocalMemoDeleted(id, 'pending_delete', ownerId);
      setMemoSaveStates((previous) => {
        if (!(id in previous)) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      });
    } catch {
      deletingMemoIdsRef.current.delete(id);
      setMemoSaveStates((previous) => ({
        ...previous,
        [id]: 'local-failed',
      }));
      if (existingMemo) {
        const restoreMemo = (previous: MemoRow[]) => {
          if (previous.some((memo) => memo.id === id)) return previous;
          return [existingMemo, ...previous].sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          );
        };
        memosRef.current = restoreMemo(memosRef.current);
        setMemos(restoreMemo);
      }
      window.alert(
        t(
          '메모를 삭제하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
          'Could not delete the note.\nCheck that this device has enough storage, then try again.',
        ),
      );
      return;
    }
    if (!currentSession) {
      deletingMemoIdsRef.current.delete(id);
      return;
    }

    void (async () => {
      try {
        await cancelMemoCloudSync(id);
        await archiveMemo(currentSession, id);
        await markLocalMemoDeleted(id, 'synced', ownerId);
      } catch {
        await markLocalMemoDeleted(id, 'pending_delete', ownerId).catch(
          () => undefined,
        );
      } finally {
        deletingMemoIdsRef.current.delete(id);
      }
    })();
  };

  return { deleteMemoById };
};
