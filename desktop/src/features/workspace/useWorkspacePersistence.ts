import { useCallback, useEffect } from 'react';

import type { TabKey } from '../../types';
import type {
  MemoSplitPaneState,
} from '../memo/components/MemoSplitWorkspace';
import { saveWorkspaceSession } from '../../lib/workspaceSession';

interface UseWorkspacePersistenceOptions {
  activeMemoId: string | null;
  activeTab: TabKey;
  focusedPaneId: string | null;
  isBooting: boolean;
  isSessionCollapsed: boolean;
  isSplitWorkspaceEnabled: boolean;
  ownerId: string | null;
  paneWidths: Record<string, number>;
  splitPanes: MemoSplitPaneState[];
}

export const useWorkspacePersistence = ({
  activeMemoId,
  activeTab,
  focusedPaneId,
  isBooting,
  isSessionCollapsed,
  isSplitWorkspaceEnabled,
  ownerId,
  paneWidths,
  splitPanes,
}: UseWorkspacePersistenceOptions) => {
  const persistWorkspace = useCallback(() => {
    saveWorkspaceSession(
      {
        activeMemoId,
        activeTab,
        focusedPaneId,
        isSessionCollapsed,
        isSplitWorkspaceEnabled,
        paneWidths,
        splitPanes,
      },
      ownerId,
    );
  }, [
    activeMemoId,
    activeTab,
    focusedPaneId,
    isSessionCollapsed,
    isSplitWorkspaceEnabled,
    ownerId,
    paneWidths,
    splitPanes,
  ]);

  useEffect(() => {
    if (isBooting) return undefined;

    const timeout = window.setTimeout(persistWorkspace, 250);
    return () => window.clearTimeout(timeout);
  }, [isBooting, persistWorkspace]);

  useEffect(() => {
    window.addEventListener('beforeunload', persistWorkspace);
    return () => window.removeEventListener('beforeunload', persistWorkspace);
  }, [persistWorkspace]);
};
