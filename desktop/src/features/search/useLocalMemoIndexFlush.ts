import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { getLocalWorkspaceOwner } from '../../services/local/offlineStore';
import {
  reconcileLocalMemoIndex,
} from '../../services/local/localMemoIndexer';
import type { MemoRow } from '../../types';

interface UseLocalMemoIndexFlushOptions {
  memosRef: MutableRefObject<MemoRow[]>;
  pendingLocalMemoWritePromisesRef: MutableRefObject<
    Map<string, Promise<void>>
  >;
  setEmbeddingGateOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * Flushes local memo writes before an explicit or blur-triggered vector index
 * reconcile. The hook owns no UI beyond the existing model-download gate.
 */
export const useLocalMemoIndexFlush = ({
  memosRef,
  pendingLocalMemoWritePromisesRef,
  setEmbeddingGateOpen,
}: UseLocalMemoIndexFlushOptions) => {
  const flushLocalMemoIndex = useCallback(
    async (memoIds?: string[], isVisible = false) => {
      const selectedIds = memoIds ? new Set(memoIds) : null;
      const pendingWrites = [...pendingLocalMemoWritePromisesRef.current]
        .filter(([memoId]) => !selectedIds || selectedIds.has(memoId))
        .map(([, promise]) => promise.catch(() => undefined));
      await Promise.all(pendingWrites);

      const candidates = memosRef.current.filter(
        (memo) => !selectedIds || selectedIds.has(memo.id),
      );
      if (candidates.length === 0) return true;
      const modelStatus = await window.electronAPI?.localEmbedStatus?.();
      if (!modelStatus?.ready) {
        if (isVisible) setEmbeddingGateOpen(true);
        return false;
      }
      await reconcileLocalMemoIndex(
        candidates,
        getLocalWorkspaceOwner(),
        isVisible,
      );
      return true;
    },
    [memosRef, pendingLocalMemoWritePromisesRef, setEmbeddingGateOpen],
  );

  const flushLocalMemoIndexForUser = useCallback(
    () => flushLocalMemoIndex(undefined, true),
    [flushLocalMemoIndex],
  );

  return { flushLocalMemoIndex, flushLocalMemoIndexForUser };
};
