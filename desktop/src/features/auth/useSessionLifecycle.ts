import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  getLocalWorkspaceOwner,
  setLocalWorkspaceOwner,
} from '../../services/local/offlineStore';
import type { InboxSession } from '../../services/backend/inboxService';
import { waitForBootSync } from './bootSession';
import type { ActivityCompletion } from '../report/growthTypes';
import type {
  CalendarBlockRow,
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  MemoRow,
  MemoSaveState,
  ScheduleInboxRow,
} from '../../types';

interface UseSessionLifecycleOptions {
  applyLocalWorkspace: (ownerId?: string) => Promise<void>;
  clearTopicMap: () => void;
  loadWorkspace: (
    targetSession?: Session | null,
    options?: { quiet?: boolean },
  ) => Promise<void>;
  memosRef: MutableRefObject<MemoRow[]>;
  memoSyncRetryAttemptsRef: MutableRefObject<Map<string, number>>;
  memoSyncRetryTimersRef: MutableRefObject<Map<string, number>>;
  resetInboxLikeState: () => void;
  restoreWorkspaceForAccount: (ownerId: string | null) => void;
  sessionActivationIdRef: MutableRefObject<number>;
  sessionRef: MutableRefObject<Session | null>;
  setActivityCompletions: Dispatch<SetStateAction<ActivityCompletion[]>>;
  setAuthNotice: Dispatch<SetStateAction<string | null>>;
  setCalendarBlocks: Dispatch<SetStateAction<CalendarBlockRow[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  setInboxLoading: Dispatch<SetStateAction<boolean>>;
  setLocalWorkspaceReady: Dispatch<SetStateAction<boolean>>;
  setManualMemoSyncRetryIds: Dispatch<SetStateAction<string[]>>;
  setMemoFolderExclusions: Dispatch<SetStateAction<MemoFolderExclusion[]>>;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
  setMemoSaveStates: Dispatch<SetStateAction<Record<string, MemoSaveState>>>;
  setMemos: Dispatch<SetStateAction<MemoRow[]>>;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
  setScheduleInbox: Dispatch<SetStateAction<ScheduleInboxRow[]>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setWorkspaceOwnerTransition: Dispatch<SetStateAction<boolean>>;
  t: (korean: string, english: string) => string;
  workspaceLoadIdRef: MutableRefObject<number>;
  deletedPendingInboxClientIdsRef: MutableRefObject<Set<string>>;
  pendingInboxDeleteIdsRef: MutableRefObject<Set<string>>;
  inboxServerIdsByClientIdRef: MutableRefObject<Map<string, string>>;
}

export const useSessionLifecycle = ({
  applyLocalWorkspace,
  clearTopicMap,
  loadWorkspace,
  memosRef,
  memoSyncRetryAttemptsRef,
  memoSyncRetryTimersRef,
  resetInboxLikeState,
  restoreWorkspaceForAccount,
  sessionActivationIdRef,
  sessionRef,
  setActivityCompletions,
  setAuthNotice,
  setCalendarBlocks,
  setError,
  setInboxItems,
  setInboxLoading,
  setLocalWorkspaceReady,
  setManualMemoSyncRetryIds,
  setMemoFolderExclusions,
  setMemoFolderMemberships,
  setMemoFolders,
  setMemoSaveStates,
  setMemos,
  setRefreshing,
  setScheduleInbox,
  setSession,
  setWorkspaceOwnerTransition,
  t,
  workspaceLoadIdRef,
  deletedPendingInboxClientIdsRef,
  pendingInboxDeleteIdsRef,
  inboxServerIdsByClientIdRef,
}: UseSessionLifecycleOptions) => {
  const activateSession = useCallback(
    async (
      nextSession: Session,
      options: {
        migrateLegacy?: boolean;
        resetWorkspace?: boolean;
      } = {},
    ) => {
      const activationId = ++sessionActivationIdRef.current;
      const ownerId = nextSession.user.id;
      const previousOwnerId =
        sessionRef.current?.user.id ?? getLocalWorkspaceOwner();
      const ownerChanged = previousOwnerId !== ownerId;

      workspaceLoadIdRef.current += 1;
      if (ownerChanged) {
        setWorkspaceOwnerTransition(true);
        setInboxLoading(false);
        setMemoSaveStates({});
        deletedPendingInboxClientIdsRef.current.clear();
        pendingInboxDeleteIdsRef.current.clear();
        inboxServerIdsByClientIdRef.current.clear();
        resetInboxLikeState();
      }
      setLocalWorkspaceOwner(ownerId);
      await window.electronAPI
        ?.setActiveWorkspaceOwner?.(ownerId)
        .catch(() => undefined);
      if (options.resetWorkspace || options.migrateLegacy) {
        restoreWorkspaceForAccount(ownerId);
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      setError(null);
      setAuthNotice(null);
      try {
        await applyLocalWorkspace(ownerId);
      } catch (caught) {
        if (sessionActivationIdRef.current !== activationId) return;
        if (ownerChanged) {
          // Fail closed on an owner boundary. Showing an empty B workspace is
          // preferable to uncovering any still-mounted A records.
          memosRef.current = [];
          setMemos([]);
          setCalendarBlocks([]);
          setInboxItems([]);
          setActivityCompletions([]);
          setScheduleInbox([]);
          clearTopicMap();
          setMemoFolders([]);
          setMemoFolderMemberships([]);
          setMemoFolderExclusions([]);
          setLocalWorkspaceReady(true);
        }
        setError(
          caught instanceof Error
            ? caught.message
            : t(
                '로컬 작업 공간을 불러오지 못했습니다.',
                'Could not load the local workspace.',
              ),
        );
        setWorkspaceOwnerTransition(false);
        return;
      }
      if (sessionActivationIdRef.current === activationId) {
        setWorkspaceOwnerTransition(false);
      }

      // 첫 서버 동기화는 여기서 기다리지만 화면을 가리지는 않는다. 부팅
      // 게이트는 로컬 준비만 보고 이미 닫혔다(Phase C).
      await waitForBootSync(loadWorkspace(nextSession, { quiet: true }));
    },
    [
      applyLocalWorkspace,
      clearTopicMap,
      loadWorkspace,
      memosRef,
      resetInboxLikeState,
      restoreWorkspaceForAccount,
      sessionActivationIdRef,
      sessionRef,
      setActivityCompletions,
      setAuthNotice,
      setCalendarBlocks,
      setError,
      setInboxItems,
      setInboxLoading,
      setLocalWorkspaceReady,
      setMemoFolderExclusions,
      setMemoFolderMemberships,
      setMemoFolders,
      setMemoSaveStates,
      setMemos,
      setScheduleInbox,
      setSession,
      setWorkspaceOwnerTransition,
      t,
      workspaceLoadIdRef,
    ],
  );

  const deactivateSession = useCallback(() => {
    sessionActivationIdRef.current += 1;
    workspaceLoadIdRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    setWorkspaceOwnerTransition(false);
    memoSyncRetryTimersRef.current.forEach((timeout) =>
      window.clearTimeout(timeout),
    );
    memoSyncRetryTimersRef.current.clear();
    memoSyncRetryAttemptsRef.current.clear();
    setManualMemoSyncRetryIds([]);
    setLocalWorkspaceOwner(null);
    void window.electronAPI
      ?.setActiveWorkspaceOwner?.(null)
      .catch(() => undefined);
    restoreWorkspaceForAccount(null);
    void applyLocalWorkspace();
    setRefreshing(false);
    setInboxLoading(false);
  }, [
    applyLocalWorkspace,
    memoSyncRetryAttemptsRef,
    memoSyncRetryTimersRef,
    restoreWorkspaceForAccount,
    sessionActivationIdRef,
    sessionRef,
    setInboxLoading,
    setManualMemoSyncRetryIds,
    setRefreshing,
    setSession,
    setWorkspaceOwnerTransition,
    workspaceLoadIdRef,
  ]);

  return { activateSession, deactivateSession };
};
