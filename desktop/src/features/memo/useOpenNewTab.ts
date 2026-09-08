import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import {
  createEditor,
  mirrorEditorPatch,
} from './memoSplitWorkspaceUtils';
import { getAppPaneEditors, createSplitPaneId } from './splitPaneState';
import { editorsAfterNewTab } from '../../lib/splitPaneTabs';
import type { TabKey } from '../../types';

interface UseOpenNewTabOptions {
  focusedPaneId: string | null;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setIsSplitWorkspaceEnabled: Dispatch<SetStateAction<boolean>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPanes: MemoSplitPaneState[];
}

export const useOpenNewTab = ({
  focusedPaneId,
  setActiveTab,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setSplitPanes,
  splitPanes,
}: UseOpenNewTabOptions) => {
  const openNewTabInFocusedSplitPane = useCallback(() => {
    const nextEditor = createEditor('memo', { isViewPicker: true });

    setActiveTab('memo');
    setIsSplitWorkspaceEnabled(true);

    if (splitPanes.length === 0) {
      const paneId = createSplitPaneId();
      setSplitPanes([
        {
          id: paneId,
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
          ...mirrorEditorPatch(nextEditor),
          view: nextEditor.view,
        },
      ]);
      setFocusedPaneId(paneId);
      return;
    }

    const targetPaneId =
      focusedPaneId && splitPanes.some(pane => pane.id === focusedPaneId)
        ? focusedPaneId
        : splitPanes[0].id;

    setSplitPanes(previous =>
      previous.map(pane =>
        pane.id === targetPaneId
          ? {
              ...pane,
              ...mirrorEditorPatch(nextEditor),
              activeEditorId: nextEditor.id,
              editors: editorsAfterNewTab(getAppPaneEditors(pane), nextEditor),
              view: nextEditor.view,
            }
          : pane,
      ),
    );
    setFocusedPaneId(targetPaneId);
  }, [
    focusedPaneId,
    setActiveTab,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
    splitPanes,
  ]);

  return { openNewTabInFocusedSplitPane };
};
