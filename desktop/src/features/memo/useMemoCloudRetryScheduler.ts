import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import { memoSyncRetryDelay } from '../../lib/memoSyncRetry';
import { memoCloudSyncInput, type MemoCloudSyncInput } from './memoCloudSync';
import type { MemoRow } from '../../types';

interface UseMemoCloudRetrySchedulerOptions {
  isCurrentSession: (expectedSession: Session) => boolean;
  memoSyncRetryAttemptsRef: MutableRefObject<Map<string, number>>;
  memoSyncRetryRunnerRef: MutableRefObject<
    | ((currentSession: Session, memo: MemoCloudSyncInput) => Promise<void>)
    | null
  >;
  memoSyncRetryTimersRef: MutableRefObject<Map<string, number>>;
  memosRef: MutableRefObject<MemoRow[]>;
}

/**
 * Owns exponential retry scheduling for failed memo uploads. Retry timers are
 * renderer-only state; the durable pending row remains the source of truth.
 */
export const useMemoCloudRetryScheduler = ({
  isCurrentSession,
  memoSyncRetryAttemptsRef,
  memoSyncRetryRunnerRef,
  memoSyncRetryTimersRef,
  memosRef,
}: UseMemoCloudRetrySchedulerOptions) => {
  useEffect(
    () => () => {
      memoSyncRetryTimersRef.current.forEach((timeout) =>
        window.clearTimeout(timeout),
      );
      memoSyncRetryTimersRef.current.clear();
      memoSyncRetryAttemptsRef.current.clear();
    },
    [memoSyncRetryAttemptsRef, memoSyncRetryTimersRef],
  );

  const cancelMemoCloudRetry = useCallback(
    (memoId: string, resetAttempts = true) => {
      const timeout = memoSyncRetryTimersRef.current.get(memoId);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        memoSyncRetryTimersRef.current.delete(memoId);
      }
      if (resetAttempts) {
        memoSyncRetryAttemptsRef.current.delete(memoId);
      }
    },
    [memoSyncRetryAttemptsRef, memoSyncRetryTimersRef],
  );

  const scheduleMemoCloudRetry = useCallback(
    (currentSession: Session, memo: MemoCloudSyncInput) => {
      if (!navigator.onLine || memoSyncRetryTimersRef.current.has(memo.id)) {
        return;
      }

      const attempt = (memoSyncRetryAttemptsRef.current.get(memo.id) ?? 0) + 1;
      memoSyncRetryAttemptsRef.current.set(memo.id, attempt);
      const timeout = window.setTimeout(() => {
        memoSyncRetryTimersRef.current.delete(memo.id);
        if (!navigator.onLine || !isCurrentSession(currentSession)) {
          return;
        }
        const latestMemo = memosRef.current.find((item) => item.id === memo.id);
        if (latestMemo?.local_sync_status !== 'failed') {
          return;
        }
        void memoSyncRetryRunnerRef.current?.(
          currentSession,
          memoCloudSyncInput(latestMemo),
        );
      }, memoSyncRetryDelay(attempt));

      memoSyncRetryTimersRef.current.set(memo.id, timeout);
    },
    [
      isCurrentSession,
      memoSyncRetryAttemptsRef,
      memoSyncRetryRunnerRef,
      memoSyncRetryTimersRef,
      memosRef,
    ],
  );

  return { cancelMemoCloudRetry, scheduleMemoCloudRetry };
};
