import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { getMemoCategory } from '../../lib/memoCategory';
import {
  activeMemoIdsInPanes,
} from '../../lib/splitPaneTabs';
import {
  mergeLoadedMemosPreservingLocalWrites,
  pendingMemoIdsForOwner,
} from '../../lib/memoLoadMerge';
import {
  getLocalWorkspaceOwner,
  loadLocalActivityCompletions,
  loadLocalInboxItems,
  loadLocalMemoFolderExclusions,
  loadLocalMemoFolderMemberships,
  loadLocalMemoFolders,
  loadLocalScheduleInbox,
  loadLocalScheduleInboxActions,
  loadLocalTopicMap,
  loadVisibleLocalCalendarBlocks,
  loadVisibleLocalMemos,
} from '../../services/local/offlineStore';
import type { InboxSession } from '../../services/backend/inboxService';
import type { ActivityCompletion } from '../report/growthTypes';
import type { MemoSplitPaneState } from '../memo/components/MemoSplitWorkspace';
import type {
  CalendarBlockRow,
  CalendarCategoryRow,
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  MemoRow,
  ScheduleInboxRow,
  TopicMapData,
} from '../../types';
import { loadCalendarCategories } from '../calendar/calendarCategories';
import { mergeInboxItems, withoutDeletedPendingInboxItems } from '../inbox/inboxState';

interface UseLocalWorkspaceHydrationOptions {
  activeMemoIdRef: MutableRefObject<string | null>;
  applyTopicMap: (topicMap: TopicMapData | null) => void;
  deletedPendingInboxClientIdsRef: MutableRefObject<Set<string>>;
  hasHydratedActiveMemoRef: MutableRefObject<boolean>;
  pendingInboxDeleteIdsRef: MutableRefObject<Set<string>>;
  pendingLocalMemoWriteOwnersRef: MutableRefObject<Map<string, string | null>>;
  setActiveDraftCategory: Dispatch<SetStateAction<string>>;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setActiveMemoId: Dispatch<SetStateAction<string | null>>;
  setActivityCompletions: Dispatch<SetStateAction<ActivityCompletion[]>>;
  setCalendarBlocks: Dispatch<SetStateAction<CalendarBlockRow[]>>;
  setCalendarCategories: Dispatch<SetStateAction<CalendarCategoryRow[]>>;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  setLocalWorkspaceReady: Dispatch<SetStateAction<boolean>>;
  setMemoFolderExclusions: Dispatch<SetStateAction<MemoFolderExclusion[]>>;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
  setMemos: Dispatch<SetStateAction<MemoRow[]>>;
  setScheduleInbox: Dispatch<SetStateAction<ScheduleInboxRow[]>>;
  splitPanesRef: MutableRefObject<MemoSplitPaneState[]>;
  memosRef: MutableRefObject<MemoRow[]>;
  workspaceLoadIdRef: MutableRefObject<number>;
}

export const useLocalWorkspaceHydration = ({
  activeMemoIdRef,
  applyTopicMap,
  deletedPendingInboxClientIdsRef,
  hasHydratedActiveMemoRef,
  pendingInboxDeleteIdsRef,
  pendingLocalMemoWriteOwnersRef,
  setActiveDraftCategory,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setActivityCompletions,
  setCalendarBlocks,
  setCalendarCategories,
  setInboxItems,
  setLocalWorkspaceReady,
  setMemoFolderExclusions,
  setMemoFolderMemberships,
  setMemoFolders,
  setMemos,
  setScheduleInbox,
  splitPanesRef,
  memosRef,
  workspaceLoadIdRef,
}: UseLocalWorkspaceHydrationOptions) => {
  const hydrateActiveMemo = useCallback((nextMemos: MemoRow[]) => {
    if (hasHydratedActiveMemoRef.current) {
      return;
    }

    const selectedMemo =
      nextMemos.find((memo) => memo.id === activeMemoIdRef.current) ??
      nextMemos[0];
    if (!selectedMemo) {
      return;
    }

    hasHydratedActiveMemoRef.current = true;
    setActiveMemoId(selectedMemo.id);
    setActiveMemoCreatedAt(selectedMemo.created_at);
    setActiveDraftCategory(getMemoCategory(selectedMemo.category));
  }, [
    activeMemoIdRef,
    hasHydratedActiveMemoRef,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
  ]);

  const applyLocalWorkspace = useCallback(
    async (ownerId?: string) => {
      const effectiveOwnerId = ownerId ?? getLocalWorkspaceOwner() ?? undefined;
      const expectedWorkspaceLoadId = workspaceLoadIdRef.current;
      const [
        localMemos,
        localBlocks,
        localInbox,
        localActivities,
        localSchedule,
        localScheduleActions,
        localTopicMap,
        localMemoFolders,
        localMemoFolderMemberships,
        localMemoFolderExclusions,
      ] = await Promise.all([
        loadVisibleLocalMemos(effectiveOwnerId),
        loadVisibleLocalCalendarBlocks(effectiveOwnerId),
        // 캐시 + 대기 큐 — 네트워크 없이도 웹 인박스가 즉시 보인다.
        loadLocalInboxItems(effectiveOwnerId),
        loadLocalActivityCompletions(effectiveOwnerId),
        // 일정 저장함 / Topics 지도도 마지막 서버 결과를 즉시 보여준다.
        loadLocalScheduleInbox(effectiveOwnerId),
        loadLocalScheduleInboxActions(effectiveOwnerId),
        loadLocalTopicMap(effectiveOwnerId),
        loadLocalMemoFolders(effectiveOwnerId),
        loadLocalMemoFolderMemberships(effectiveOwnerId),
        loadLocalMemoFolderExclusions(effectiveOwnerId),
      ]);

      if (
        expectedWorkspaceLoadId !== workspaceLoadIdRef.current ||
        getLocalWorkspaceOwner() !== (effectiveOwnerId ?? null)
      ) {
        return;
      }

      for (const item of localInbox) {
        if (item.local_sync_status === 'pending_delete') {
          pendingInboxDeleteIdsRef.current.add(item.id);
          if (item.clientId) {
            deletedPendingInboxClientIdsRef.current.add(item.clientId);
          }
        }
      }

      const pendingLocalWriteIds = pendingMemoIdsForOwner(
        pendingLocalMemoWriteOwnersRef.current,
        effectiveOwnerId,
      );
      const activeEditorMemoIds = activeMemoIdsInPanes(splitPanesRef.current);
      const visibleMemos = mergeLoadedMemosPreservingLocalWrites(
        localMemos,
        memosRef.current,
        pendingLocalWriteIds,
        activeEditorMemoIds,
      );
      setMemos(visibleMemos);
      setCalendarBlocks(localBlocks);
      setCalendarCategories(loadCalendarCategories(effectiveOwnerId ?? null));
      setInboxItems(
        mergeInboxItems(
          [],
          withoutDeletedPendingInboxItems(
            localInbox,
            deletedPendingInboxClientIdsRef.current,
            pendingInboxDeleteIdsRef.current,
          ),
        ),
      );
      setActivityCompletions(localActivities);
      const handledScheduleIds = new Set(
        localScheduleActions.map((action) => action.id),
      );
      setScheduleInbox(
        localSchedule.filter((item) => !handledScheduleIds.has(item.id)),
      );
      applyTopicMap(localTopicMap);
      setMemoFolders(localMemoFolders);
      setMemoFolderMemberships(localMemoFolderMemberships);
      setMemoFolderExclusions(localMemoFolderExclusions);

      hydrateActiveMemo(visibleMemos);
      setLocalWorkspaceReady(true);
    },
    [
      applyTopicMap,
      deletedPendingInboxClientIdsRef,
      hydrateActiveMemo,
      memosRef,
      pendingInboxDeleteIdsRef,
      pendingLocalMemoWriteOwnersRef,
      setActivityCompletions,
      setCalendarBlocks,
      setCalendarCategories,
      setInboxItems,
      setLocalWorkspaceReady,
      setMemoFolderExclusions,
      setMemoFolderMemberships,
      setMemoFolders,
      setMemos,
      setScheduleInbox,
      splitPanesRef,
      workspaceLoadIdRef,
    ],
  );

  return { applyLocalWorkspace, hydrateActiveMemo };
};
