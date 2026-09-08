import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { activeMemoIdsInPanes } from '../../lib/splitPaneTabs';
import {
  mergeLoadedMemosPreservingLocalWrites,
  partitionRemoteMemoConflictCopies,
  pendingMemoIdsForOwner,
} from '../../lib/memoLoadMerge';
import {
  collectPendingInboxDeletes,
  mergeInboxItems,
  withoutDeletedPendingInboxItems,
} from '../inbox/inboxState';
import { mergePendingScheduleInbox } from '../schedule/scheduleInboxUtils';
import {
  loadLocalInboxItems,
  loadLocalMemoFolderActions,
  loadLocalScheduleInbox,
  loadLocalScheduleInboxActions,
  replaceLocalInboxCache,
  replaceLocalMemoFolderExclusions,
  replaceLocalMemoFolderMemberships,
  replaceLocalMemoFolders,
  replaceLocalScheduleInbox,
  saveLocalTopicMap,
  preserveLocalMemoRecovery,
  replaceSyncedCalendarBlocks,
  replaceSyncedMemos,
  restoreLocalMemoSnapshotAfterPull,
} from '../../services/local/offlineStore';
import {
  ensureProfile,
  fetchCalendarBlocks,
  fetchMemoFolders,
  fetchMemos,
  fetchScheduleInbox,
  fetchTopicMap,
} from '../../services/supabase/data';
import {
  fetchInboxSessions,
  type InboxSession,
} from '../../services/backend/inboxService';
import type {
  CalendarBlockRow,
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  MemoRow,
  ScheduleInboxRow,
  TopicMapData,
} from '../../types';
import type { MemoSplitPaneState } from '../memo/components/MemoSplitWorkspace';

interface UseWorkspaceLoaderOptions {
  applyLocalWorkspace: (ownerId?: string) => Promise<void>;
  applyTopicMap: (topicMap: TopicMapData | null) => void;
  deletedPendingInboxClientIdsRef: MutableRefObject<Set<string>>;
  hydrateActiveMemo: (nextMemos: MemoRow[]) => void;
  inboxRefreshSequenceRef: MutableRefObject<number>;
  lastSyncStorageKey: string;
  memosRef: MutableRefObject<MemoRow[]>;
  pendingInboxDeleteIdsRef: MutableRefObject<Set<string>>;
  pendingLocalMemoWriteOwnersRef: MutableRefObject<Map<string, string | null>>;
  reconcileRemoteInboxLikes: (
    items: InboxSession[],
    requestSequence: number,
  ) => InboxSession[];
  retryDeletedPendingInboxItems: (
    currentSession: Session,
    items: InboxSession[],
    ownerId: string,
  ) => void;
  sessionRef: MutableRefObject<Session | null>;
  setCalendarBlocks: Dispatch<SetStateAction<CalendarBlockRow[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  setLastSyncAt: Dispatch<SetStateAction<string | null>>;
  setMemoFolderExclusions: Dispatch<SetStateAction<MemoFolderExclusion[]>>;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
  setMemos: Dispatch<SetStateAction<MemoRow[]>>;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
  setScheduleInbox: Dispatch<SetStateAction<ScheduleInboxRow[]>>;
  splitPanesRef: MutableRefObject<MemoSplitPaneState[]>;
  syncPendingLocalWorkspace: (currentSession: Session) => Promise<void>;
  t: (korean: string, english: string) => string;
  workspaceLoadIdRef: MutableRefObject<number>;
}

export const useWorkspaceLoader = ({
  applyLocalWorkspace,
  applyTopicMap,
  deletedPendingInboxClientIdsRef,
  hydrateActiveMemo,
  inboxRefreshSequenceRef,
  lastSyncStorageKey,
  memosRef,
  pendingInboxDeleteIdsRef,
  pendingLocalMemoWriteOwnersRef,
  reconcileRemoteInboxLikes,
  retryDeletedPendingInboxItems,
  sessionRef,
  setCalendarBlocks,
  setError,
  setInboxItems,
  setLastSyncAt,
  setMemoFolderExclusions,
  setMemoFolderMemberships,
  setMemoFolders,
  setMemos,
  setRefreshing,
  setScheduleInbox,
  splitPanesRef,
  syncPendingLocalWorkspace,
  t,
  workspaceLoadIdRef,
}: UseWorkspaceLoaderOptions) => {
  const loadWorkspace = useCallback(
    async (
      targetSession?: Session | null,
      options: { quiet?: boolean } = {},
    ) => {
      const currentSession = targetSession ?? sessionRef.current;
      const loadId = ++workspaceLoadIdRef.current;

      if (!currentSession) {
        await applyLocalWorkspace();
        return;
      }

      const ownerId = currentSession.user.id;
      const isCurrentLoad = () =>
        loadId === workspaceLoadIdRef.current &&
        sessionRef.current?.user.id === ownerId;

      if (!options.quiet) {
        setRefreshing(true);
      }
      setError(null);

      try {
        // Profile upsert is non-critical and can transiently 401 while the
        // Supabase session is still hydrating on startup. Don't let it abort
        // the data sync below — it self-heals on the next sync.
        try {
          await ensureProfile(currentSession.user.id);
        } catch (profileError) {
          console.warn(
            'ensureProfile skipped (will retry on next sync):',
            profileError,
          );
        }
        await syncPendingLocalWorkspace(currentSession);
        if (!isCurrentLoad()) {
          return;
        }

        const inboxRequestSequence = ++inboxRefreshSequenceRef.current;
        const [nextMemos, nextBlocks, nextInbox, nextLinkInbox, nextFolders] =
          await Promise.all([
            fetchMemos(currentSession),
            fetchCalendarBlocks(currentSession),
            fetchScheduleInbox(currentSession),
            // 실패는 null — 빈 목록으로 로컬 캐시 표시를 덮어쓰지 않는다
            // (부팅 직후 토큰 하이드레이션/백엔드 콜드스타트로 잘 실패한다).
            fetchInboxSessions(currentSession).catch(() => null),
            // A desktop release can briefly precede its database migration.
            // Keep the local folder cache instead of failing the workspace.
            fetchMemoFolders(currentSession).catch(() => null),
          ]);
        // 실패는 null — 빈 지도로 로컬 캐시 표시를 덮어쓰지 않는다.
        const nextTopicMap = await fetchTopicMap(currentSession).catch(
          () => null,
        );

        if (!isCurrentLoad()) {
          return;
        }

        const { conflictCopies, visibleMemos: visibleRemoteMemos } =
          partitionRemoteMemoConflictCopies(nextMemos);
        await Promise.all(
          conflictCopies.map((memo) => {
            const originalMemoId = memo.conflict_of;
            if (!originalMemoId) return Promise.resolve();
            return preserveLocalMemoRecovery(
              {
                content: memo.content,
                memoId: originalMemoId,
                source: 'local',
                sourceUpdatedAt: memo.content_updated_at ?? memo.updated_at,
              },
              ownerId,
            );
          }),
        );
        // Snapshot protection at response time, not request time: a pane may
        // have opened or received input while the network request was pending.
        // Skipping the same ids in SQLite and React keeps the acknowledged
        // sync base intact, so the next edit conflicts/merges with the remote
        // value instead of overwriting it as if that value had been seen.
        const pendingLocalWriteIds = pendingMemoIdsForOwner(
          pendingLocalMemoWriteOwnersRef.current,
          ownerId,
        );
        const activeEditorMemoIds = activeMemoIdsInPanes(splitPanesRef.current);
        const protectedMemoIds = new Set([
          ...pendingLocalWriteIds,
          ...activeEditorMemoIds,
        ]);
        const [mergedMemos, mergedBlocks] = await Promise.all([
          replaceSyncedMemos(visibleRemoteMemos, ownerId, protectedMemoIds),
          replaceSyncedCalendarBlocks(nextBlocks, ownerId),
        ]);
        const scheduleActions = await loadLocalScheduleInboxActions(ownerId);
        const handledScheduleIds = new Set(
          scheduleActions.map((action) => action.id),
        );
        const visibleScheduleInbox = mergePendingScheduleInbox(
          nextInbox,
          await loadLocalScheduleInbox(ownerId),
          handledScheduleIds,
        );
        let mergedMemosForView = mergedMemos;
        const restoredLateSnapshotIds = new Set<string>();
        let latestPendingLocalWriteIds = pendingLocalWriteIds;
        let latestActiveEditorMemoIds = activeEditorMemoIds;
        let shouldCheckLateSnapshots = true;
        while (shouldCheckLateSnapshots) {
          latestPendingLocalWriteIds = pendingMemoIdsForOwner(
            pendingLocalMemoWriteOwnersRef.current,
            ownerId,
          );
          latestActiveEditorMemoIds = activeMemoIdsInPanes(
            splitPanesRef.current,
          );
          const latestProtectedMemoIds = new Set([
            ...latestPendingLocalWriteIds,
            ...latestActiveEditorMemoIds,
          ]);
          const lateSnapshots = memosRef.current.filter((memo) => {
            if (
              protectedMemoIds.has(memo.id) ||
              !latestProtectedMemoIds.has(memo.id) ||
              restoredLateSnapshotIds.has(memo.id)
            ) {
              return false;
            }
            return true;
          });
          if (lateSnapshots.length === 0) {
            shouldCheckLateSnapshots = false;
            continue;
          }

          for (const memo of lateSnapshots) {
            restoredLateSnapshotIds.add(memo.id);
          }
          await Promise.all(
            lateSnapshots.map((memo) =>
              restoreLocalMemoSnapshotAfterPull(memo, ownerId),
            ),
          );
          const lateById = new Map(
            lateSnapshots.map((memo) => [memo.id, memo]),
          );
          const existingIds = new Set(
            mergedMemosForView.map((memo) => memo.id),
          );
          mergedMemosForView = [
            ...mergedMemosForView.map((memo) => lateById.get(memo.id) ?? memo),
            ...lateSnapshots.filter((memo) => !existingIds.has(memo.id)),
          ];
        }
        if (!isCurrentLoad()) return;

        setMemos(
          mergeLoadedMemosPreservingLocalWrites(
            mergedMemosForView,
            memosRef.current,
            latestPendingLocalWriteIds,
            latestActiveEditorMemoIds,
          ),
        );
        setCalendarBlocks(mergedBlocks);
        setScheduleInbox(visibleScheduleInbox);
        await replaceLocalScheduleInbox(visibleScheduleInbox, ownerId);
        if (!isCurrentLoad()) return;
        if (nextLinkInbox) {
          const latestLocalInbox = await loadLocalInboxItems(ownerId);
          if (!isCurrentLoad()) return;
          const localDeletes = collectPendingInboxDeletes(latestLocalInbox);
          localDeletes.ids.forEach((id) =>
            pendingInboxDeleteIdsRef.current.add(id),
          );
          localDeletes.clientIds.forEach((clientId) =>
            deletedPendingInboxClientIdsRef.current.add(clientId),
          );
          const currentLinkInbox = reconcileRemoteInboxLikes(
            nextLinkInbox,
            inboxRequestSequence,
          );
          retryDeletedPendingInboxItems(
            currentSession,
            currentLinkInbox,
            ownerId,
          );
          const visibleLinkInbox = withoutDeletedPendingInboxItems(
            currentLinkInbox,
            deletedPendingInboxClientIdsRef.current,
            pendingInboxDeleteIdsRef.current,
          );
          const visibleLocalInbox = withoutDeletedPendingInboxItems(
            latestLocalInbox,
            deletedPendingInboxClientIdsRef.current,
            pendingInboxDeleteIdsRef.current,
          );
          await replaceLocalInboxCache(visibleLinkInbox, ownerId);
          if (!isCurrentLoad()) return;
          setInboxItems(mergeInboxItems(visibleLinkInbox, visibleLocalInbox));
        }
        if (nextTopicMap) {
          await saveLocalTopicMap(nextTopicMap, ownerId);
          if (!isCurrentLoad()) return;
          applyTopicMap(nextTopicMap);
        }
        if (nextFolders) {
          // Folder deletes use a local outbox so they survive a restart. Until
          // that outbox reaches the server, exclude the stale remote rows from
          // this pull; otherwise an offline deletion visibly resurrects.
          const pendingFolderActions =
            await loadLocalMemoFolderActions(ownerId);
          const deletedFolderIds = new Set(
            pendingFolderActions
              .filter((action) => action.kind === 'delete_folder')
              .map((action) => action.folderId),
          );
          const deletedMemberships = new Set(
            pendingFolderActions
              .filter(
                (action) =>
                  action.kind === 'delete_membership' && action.memoId,
              )
              .map((action) => `${action.folderId}:${action.memoId}`),
          );
          const deletedExclusions = new Set(
            pendingFolderActions
              .filter(
                (action) => action.kind === 'delete_exclusion' && action.memoId,
              )
              .map((action) => `${action.folderId}:${action.memoId}`),
          );
          const visibleFolders = nextFolders.folders.filter(
            (folder: MemoFolder) => !deletedFolderIds.has(folder.id),
          );
          const visibleFolderMemberships = nextFolders.memberships.filter(
            (membership: MemoFolderMembership) =>
              !deletedFolderIds.has(membership.folderId) &&
              !deletedMemberships.has(
                `${membership.folderId}:${membership.memoId}`,
              ),
          );
          const visibleFolderExclusions = nextFolders.exclusions.filter(
            (exclusion: MemoFolderExclusion) =>
              !deletedFolderIds.has(exclusion.folderId) &&
              !deletedExclusions.has(
                `${exclusion.folderId}:${exclusion.memoId}`,
              ),
          );
          const [
            mergedFolders,
            mergedFolderMemberships,
            mergedFolderExclusions,
          ] = await Promise.all([
            replaceLocalMemoFolders(visibleFolders, ownerId),
            replaceLocalMemoFolderMemberships(
              visibleFolderMemberships,
              ownerId,
            ),
            replaceLocalMemoFolderExclusions(visibleFolderExclusions, ownerId),
          ]);
          if (!isCurrentLoad()) return;
          setMemoFolders(mergedFolders);
          setMemoFolderMemberships(mergedFolderMemberships);
          setMemoFolderExclusions(mergedFolderExclusions);
        }
        // 실패(null) 시: applyLocalWorkspace가 깔아둔 캐시를 그대로 둔다.

        hydrateActiveMemo(mergedMemosForView);
        const syncedAt = new Date().toISOString();
        setLastSyncAt(syncedAt);
        window.localStorage?.setItem(lastSyncStorageKey, syncedAt);
      } catch (caught) {
        if (!isCurrentLoad()) {
          return;
        }
        // 로컬 데이터는 이미 화면에 있고 다음 동기화가 알아서 따라잡는다.
        // 사용자가 할 수 있는 일이 없어 조용히 넘긴다.
        setError(
          caught instanceof Error
            ? caught.message
            : t('데이터를 불러오지 못했습니다.', 'Could not load your data.'),
        );
        await applyLocalWorkspace(ownerId);
      } finally {
        if (loadId === workspaceLoadIdRef.current) {
          setRefreshing(false);
        }
      }
    },
    [
      applyLocalWorkspace,
      applyTopicMap,
      deletedPendingInboxClientIdsRef,
      hydrateActiveMemo,
      inboxRefreshSequenceRef,
      lastSyncStorageKey,
      memosRef,
      pendingInboxDeleteIdsRef,
      pendingLocalMemoWriteOwnersRef,
      reconcileRemoteInboxLikes,
      retryDeletedPendingInboxItems,
      sessionRef,
      setCalendarBlocks,
      setError,
      setInboxItems,
      setLastSyncAt,
      setMemoFolderExclusions,
      setMemoFolderMemberships,
      setMemoFolders,
      setMemos,
      setRefreshing,
      setScheduleInbox,
      splitPanesRef,
      syncPendingLocalWorkspace,
      t,
      workspaceLoadIdRef,
    ],
  );

  return { loadWorkspace };
};
