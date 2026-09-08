import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { editorAtRelativeTab } from '../../lib/splitPaneTabs';
import type { TabKey } from '../../types';
import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import { mirrorEditorPatch } from './memoSplitWorkspaceUtils';
import { getAppPaneEditors } from './splitPaneState';

interface UseRelativeTabFocusOptions {
  focusedPaneId: string | null;
  onSelectMemoById: (memoId: string) => void;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPanes: MemoSplitPaneState[];
}

export const useRelativeTabFocus = ({
  focusedPaneId,
  onSelectMemoById,
  setActiveTab,
  setFocusedPaneId,
  setSplitPanes,
  splitPanes,
}: UseRelativeTabFocusOptions) => {
  const focusRelativeTab = useCallback(
    (offset: number) => {
      const pane =
        splitPanes.find(candidate => candidate.id === focusedPaneId) ??
        splitPanes[0];
      if (!pane) return;

      const editors = getAppPaneEditors(pane);
      const nextEditor = editorAtRelativeTab(
        editors,
        pane.activeEditorId,
        offset,
      );
      if (!nextEditor) return;

      setActiveTab('memo');
      setFocusedPaneId(pane.id);
      if (nextEditor.memoId) {
        onSelectMemoById(nextEditor.memoId);
      }
      setSplitPanes(previous =>
        previous.map(candidate =>
          candidate.id === pane.id
            ? {
                ...candidate,
                ...mirrorEditorPatch(nextEditor),
                activeEditorId: nextEditor.id,
                editors: getAppPaneEditors(candidate),
                view: nextEditor.view,
              }
            : candidate,
        ),
      );
    },
    [
      focusedPaneId,
      onSelectMemoById,
      setActiveTab,
      setFocusedPaneId,
      setSplitPanes,
      splitPanes,
    ],
  );

  return { focusRelativeTab };
};
