import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  fetchInboxSessions,
  type InboxSession,
} from '../../services/backend/inboxService';
import {
  loadLocalInboxItems,
  loadLocalInboxQueue,
  replaceLocalInboxCache,
} from '../../services/local/offlineStore';
import {
  collectPendingInboxDeletes,
  mergeInboxItems,
  withoutDeletedPendingInboxItems,
} from './inboxState';

type SessionRef = { current: Session | null };
type SequenceRef = { current: number };
type InboxIdRef = { current: Set<string> };
type Translate = (korean: string, english: string) => string;

interface UseInboxRefreshOptions {
  currentSession: Session | null;
  currentSessionRef: SessionRef;
  deletedPendingInboxClientIdsRef: InboxIdRef;
  pendingInboxDeleteIdsRef: InboxIdRef;
  refreshSequenceRef: SequenceRef;
  reconcileRemoteInboxLikes: (
    items: InboxSession[],
    requestSequence: number,
  ) => InboxSession[];
  retryDeletedPendingInboxItems: (
    currentSession: Session,
    items: InboxSession[],
    ownerId: string,
  ) => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  setInboxLoading: Dispatch<SetStateAction<boolean>>;
  syncPendingLocalWorkspace: (currentSession: Session) => Promise<void>;
  translate: Translate;
}

export const useInboxRefresh = ({
  currentSession,
  currentSessionRef,
  deletedPendingInboxClientIdsRef,
  pendingInboxDeleteIdsRef,
  refreshSequenceRef,
  reconcileRemoteInboxLikes,
  retryDeletedPendingInboxItems,
  setError,
  setInboxItems,
  setInboxLoading,
  syncPendingLocalWorkspace,
  translate: t,
}: UseInboxRefreshOptions) => {
  const refreshInbox = useCallback(async () => {
    if (!currentSession) {
      const localItems = await loadLocalInboxItems();
      if (currentSessionRef.current) return;
      const localDeletes = collectPendingInboxDeletes(localItems);
      setInboxItems(
        mergeInboxItems(
          [],
          withoutDeletedPendingInboxItems(
            localItems,
            localDeletes.clientIds,
            localDeletes.ids,
          ),
        ),
      );
      return;
    }
    const ownerId = currentSession.user.id;
    const requestSequence = ++refreshSequenceRef.current;
    const isCurrentInboxRequest = () =>
      currentSessionRef.current?.user.id === ownerId &&
      refreshSequenceRef.current === requestSequence;

    setInboxLoading(true);
    setError(null);
    try {
      // 큐 스냅샷을 먼저 떠 두고, 대기 항목 재전송은 병렬로 돌린다 —
      // 밀린 메모/캘린더 푸시가 목록 표시를 막던 직렬 구조를 푼 것.
      // 재전송으로 큐에서 빠진 항목은 스냅샷으로 계속 표시되고, 서버
      // 반영분은 다음 새로고침에서 합류한다.
      const queuedItems = await loadLocalInboxQueue(ownerId);
      void syncPendingLocalWorkspace(currentSession).catch(error => {
        console.warn('pending sync skipped (retries on next sync):', error);
      });
      const nextItems = await fetchInboxSessions(currentSession);
      if (!isCurrentInboxRequest()) {
        return;
      }
      const latestLocalInbox = await loadLocalInboxItems(ownerId);
      if (!isCurrentInboxRequest()) return;
      const localDeletes = collectPendingInboxDeletes(latestLocalInbox);
      localDeletes.ids.forEach(id => pendingInboxDeleteIdsRef.current.add(id));
      localDeletes.clientIds.forEach(clientId =>
        deletedPendingInboxClientIdsRef.current.add(clientId),
      );
      const currentItems = reconcileRemoteInboxLikes(
        nextItems,
        requestSequence,
      );
      retryDeletedPendingInboxItems(currentSession, currentItems, ownerId);
      const visibleNextItems = withoutDeletedPendingInboxItems(
        currentItems,
        deletedPendingInboxClientIdsRef.current,
        pendingInboxDeleteIdsRef.current,
      );
      const visibleQueuedItems = withoutDeletedPendingInboxItems(
        queuedItems,
        deletedPendingInboxClientIdsRef.current,
        pendingInboxDeleteIdsRef.current,
      );
      await replaceLocalInboxCache(visibleNextItems, ownerId);
      if (!isCurrentInboxRequest()) return;
      setInboxItems(mergeInboxItems(visibleNextItems, visibleQueuedItems));
    } catch (caught) {
      if (!isCurrentInboxRequest()) {
        return;
      }
      // 캐시가 그대로 보이고 탭을 다시 열면 재조회된다. 조용히 넘긴다.
      setError(
        caught instanceof Error
          ? caught.message
          : t('수집함을 불러오지 못했습니다.', 'Could not load saved links.'),
      );
    } finally {
      if (isCurrentInboxRequest()) {
        setInboxLoading(false);
      }
    }
  }, [
    currentSession,
    currentSessionRef,
    deletedPendingInboxClientIdsRef,
    pendingInboxDeleteIdsRef,
    reconcileRemoteInboxLikes,
    refreshSequenceRef,
    retryDeletedPendingInboxItems,
    setError,
    setInboxItems,
    setInboxLoading,
    syncPendingLocalWorkspace,
    t,
  ]);

  return { refreshInbox };
};
