import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { MemoRow, TabKey } from '../../types';
import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import { createEditor, mirrorEditorPatch } from './memoSplitWorkspaceUtils';
import { createSplitPaneId } from './splitPaneState';

interface UseEnsureMemoWorkspacePaneOptions {
  activeMemo: MemoRow | null;
  activeTab: TabKey;
  memos: MemoRow[];
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setIsSplitWorkspaceEnabled: Dispatch<SetStateAction<boolean>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPaneCount: number;
}

export const useEnsureMemoWorkspacePane = ({
  activeMemo,
  activeTab,
  memos,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setSplitPanes,
  splitPaneCount,
}: UseEnsureMemoWorkspacePaneOptions) => {
  useEffect(() => {
    if (activeTab !== 'memo' || splitPaneCount > 0) {
      return;
    }

    const seedMemo = activeMemo ?? memos[0] ?? null;
    const nextEditor = createEditor(
      'memo',
      seedMemo
        ? {
            memoId: seedMemo.id,
            mode: 'existing',
          }
        : {},
    );
    const nextPane: MemoSplitPaneState = {
      id: createSplitPaneId(),
      activeEditorId: nextEditor.id,
      editors: [nextEditor],
      ...mirrorEditorPatch(nextEditor),
      view: nextEditor.view,
    };

    setIsSplitWorkspaceEnabled(true);
    setSplitPanes([nextPane]);
    setFocusedPaneId(nextPane.id);
  }, [activeMemo, activeTab, memos, setFocusedPaneId, setIsSplitWorkspaceEnabled, setSplitPanes, splitPaneCount]);
};
