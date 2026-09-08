import { useCallback, type MutableRefObject } from 'react';

import { DEFAULT_MEMO_CATEGORY } from '../../lib/memoCategory';
import { loadPinnedMemoIds } from '../../lib/pinnedMemos';
import { loadSeenReportMonth } from '../report/monthlyReport';
import { loadWorkspaceSession } from '../../lib/workspaceSession';
import { loadCalendarCategories } from '../calendar/calendarCategories';
import type { CalendarCategoryRow, TabKey } from '../../types';
import type { MemoSplitPaneState } from '../memo/components/MemoSplitWorkspace';

interface UseWorkspaceRestorationOptions {
  activeMemoIdRef: MutableRefObject<string | null>;
  hasHydratedActiveMemoRef: MutableRefObject<boolean>;
  sidebarCollapseTimerRef: MutableRefObject<number | null>;
  setActiveDraftCategory: (value: string) => void;
  setActiveMemoCreatedAt: (value: string) => void;
  setActiveMemoId: (value: string | null) => void;
  setActiveTab: (value: TabKey) => void;
  setCalendarCategories: (value: CalendarCategoryRow[]) => void;
  setFloatingNavDismissed: (value: boolean) => void;
  setFocusedPaneId: (value: string | null) => void;
  setIsSplitWorkspaceEnabled: (value: boolean) => void;
  setPaneWidths: (value: Record<string, number>) => void;
  setPinnedMemoIds: (value: string[]) => void;
  setSeenReportMonth: (value: string | null) => void;
  setSessionCollapsed: (value: boolean) => void;
  setSidebarCollapseReady: (value: boolean) => void;
  setSplitPanes: (value: MemoSplitPaneState[]) => void;
}

export const useWorkspaceRestoration = ({
  activeMemoIdRef,
  hasHydratedActiveMemoRef,
  sidebarCollapseTimerRef,
  setActiveDraftCategory,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setActiveTab,
  setCalendarCategories,
  setFloatingNavDismissed,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setPaneWidths,
  setPinnedMemoIds,
  setSeenReportMonth,
  setSessionCollapsed,
  setSidebarCollapseReady,
  setSplitPanes,
}: UseWorkspaceRestorationOptions) =>
  useCallback((ownerId: string | null) => {
    const restored = loadWorkspaceSession(ownerId);
    setPinnedMemoIds(loadPinnedMemoIds(ownerId));
    setCalendarCategories(loadCalendarCategories(ownerId));
    setSeenReportMonth(loadSeenReportMonth(ownerId));
    hasHydratedActiveMemoRef.current = false;
    activeMemoIdRef.current = restored?.activeMemoId ?? null;
    setActiveMemoId(restored?.activeMemoId ?? null);
    setActiveTab(restored?.activeTab ?? 'memo');
    setActiveMemoCreatedAt(new Date().toISOString());
    setActiveDraftCategory(DEFAULT_MEMO_CATEGORY);
    setSplitPanes(restored?.splitPanes ?? []);
    setFocusedPaneId(restored?.focusedPaneId ?? null);
    setPaneWidths(restored?.paneWidths ?? {});
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
      sidebarCollapseTimerRef.current = null;
    }
    const restoredSessionCollapsed = restored?.isSessionCollapsed ?? false;
    setSessionCollapsed(restoredSessionCollapsed);
    setSidebarCollapseReady(restoredSessionCollapsed);
    setFloatingNavDismissed(false);
    setIsSplitWorkspaceEnabled(restored?.isSplitWorkspaceEnabled ?? true);
  }, [
    activeMemoIdRef,
    hasHydratedActiveMemoRef,
    sidebarCollapseTimerRef,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setActiveTab,
    setCalendarCategories,
    setFloatingNavDismissed,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setPaneWidths,
    setPinnedMemoIds,
    setSeenReportMonth,
    setSessionCollapsed,
    setSidebarCollapseReady,
    setSplitPanes,
  ]);
