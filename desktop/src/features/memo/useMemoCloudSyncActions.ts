import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { memoCloudSyncInput, type MemoCloudSyncInput } from './memoCloudSync';
import type { MemoRow } from '../../types';

interface UseMemoCloudSyncActionsOptions {
  cancelMemoCloudRetry: (memoId: string) => void;
  enqueueMemoCloudSync: (
    currentSession: Session,
    memo: MemoCloudSyncInput,
    revision: number,
  ) => Promise<void>;
  memoSyncChainsRef: MutableRefObject<Map<string, Promise<void>>>;
  memoSyncRevisionsRef: MutableRefObject<Map<string, number>>;
  memoSyncRetryRunnerRef: MutableRefObject<
    | ((currentSession: Session, memo: MemoCloudSyncInput) => Promise<void>)
    | null
  >;
  memoSyncTimersRef: MutableRefObject<Map<string, number>>;
  memosRef: MutableRefObject<MemoRow[]>;
  sessionRef: MutableRefObject<Session | null>;
  setManualMemoSyncRetryIds: Dispatch<SetStateAction<string[]>>;
}

export const useMemoCloudSyncActions = ({
  cancelMemoCloudRetry,
  enqueueMemoCloudSync,
  memoSyncChainsRef,
  memoSyncRevisionsRef,
  memoSyncRetryRunnerRef,
  memoSyncTimersRef,
  memosRef,
  sessionRef,
  setManualMemoSyncRetryIds,
}: UseMemoCloudSyncActionsOptions) => {
  const runMemoCloudRetry = useCallback(
    async (currentSession: Session, memo: MemoCloudSyncInput) => {
      const revision = (memoSyncRevisionsRef.current.get(memo.id) ?? 0) + 1;
      memoSyncRevisionsRef.current.set(memo.id, revision);
      await enqueueMemoCloudSync(currentSession, memo, revision);
    },
    [enqueueMemoCloudSync],
  );

  useEffect(() => {
    memoSyncRetryRunnerRef.current = runMemoCloudRetry;
    return () => {
      memoSyncRetryRunnerRef.current = null;
    };
  }, [runMemoCloudRetry]);

  const syncMemoToCloudNow = useCallback(
    async (currentSession: Session, memo: MemoCloudSyncInput) => {
      const timeout = memoSyncTimersRef.current.get(memo.id);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        memoSyncTimersRef.current.delete(memo.id);
      }
      cancelMemoCloudRetry(memo.id);
      await runMemoCloudRetry(currentSession, memo);
    },
    [cancelMemoCloudRetry, runMemoCloudRetry],
  );

  const retryFailedMemoCloudSync = useCallback(
    async (memoId: string) => {
      const currentSession = sessionRef.current;
      const memo = memosRef.current.find((item) => item.id === memoId);
      if (!currentSession || memo?.local_sync_status !== 'failed') {
        return;
      }

      setManualMemoSyncRetryIds((previous) => [
        ...new Set([...previous, memoId]),
      ]);
      try {
        await syncMemoToCloudNow(currentSession, memoCloudSyncInput(memo));
      } finally {
        setManualMemoSyncRetryIds((previous) =>
          previous.filter((id) => id !== memoId),
        );
      }
    },
    [setManualMemoSyncRetryIds, syncMemoToCloudNow],
  );

  const cancelMemoCloudSync = useCallback(
    async (memoId: string) => {
      const timeout = memoSyncTimersRef.current.get(memoId);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        memoSyncTimersRef.current.delete(memoId);
      }
      cancelMemoCloudRetry(memoId);
      memoSyncRevisionsRef.current.set(
        memoId,
        (memoSyncRevisionsRef.current.get(memoId) ?? 0) + 1,
      );
      await memoSyncChainsRef.current.get(memoId)?.catch(() => undefined);
    },
    [cancelMemoCloudRetry],
  );

  return {
    cancelMemoCloudSync,
    retryFailedMemoCloudSync,
    syncMemoToCloudNow,
  };
};
