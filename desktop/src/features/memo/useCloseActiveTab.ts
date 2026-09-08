import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { editorsAfterCloseTab } from '../../lib/splitPaneTabs';
import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import { mirrorEditorPatch } from './memoSplitWorkspaceUtils';
import { getAppActiveEditor, getAppPaneEditors } from './splitPaneState';

interface UseCloseActiveTabOptions {
  focusedPaneId: string | null;
  handleClosePane: (id: string) => void;
  onSelectMemoById: (memoId: string) => void;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPanes: MemoSplitPaneState[];
}

export const useCloseActiveTab = ({
  focusedPaneId,
  handleClosePane,
  onSelectMemoById,
  setFocusedPaneId,
  setSplitPanes,
  splitPanes,
}: UseCloseActiveTabOptions) => {
  const closeActiveTab = useCallback(() => {
    const pane =
      splitPanes.find(candidate => candidate.id === focusedPaneId) ??
      splitPanes[0];
    if (!pane) return;

    const editors = getAppPaneEditors(pane);
    const activeEditor = getAppActiveEditor(pane);
    if (editors.length <= 1) {
      handleClosePane(pane.id);
      return;
    }

    const { activeEditor: nextEditor, editors: nextEditors } =
      editorsAfterCloseTab(editors, activeEditor.id, activeEditor.id);
    if (!nextEditor) return;

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
              editors: nextEditors,
              view: nextEditor.view,
            }
          : candidate,
      ),
    );
  }, [
    focusedPaneId,
    handleClosePane,
    onSelectMemoById,
    setFocusedPaneId,
    setSplitPanes,
    splitPanes,
  ]);

  return { closeActiveTab };
};
