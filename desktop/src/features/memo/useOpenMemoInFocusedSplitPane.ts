import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { MemoRow } from '../../types';
import {
  createEditor,
  mirrorEditorPatch,
} from './memoSplitWorkspaceUtils';
import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import { createSplitPaneId, getAppPaneEditors } from './splitPaneState';
import { editorsAfterOpenTab } from '../../lib/splitPaneTabs';

interface UseOpenMemoInFocusedSplitPaneOptions {
  focusedPaneId: string | null;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setIsSplitWorkspaceEnabled: Dispatch<SetStateAction<boolean>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
}

export const useOpenMemoInFocusedSplitPane = ({
  focusedPaneId,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setSplitPanes,
}: UseOpenMemoInFocusedSplitPaneOptions) => {
  const openMemoInFocusedSplitPane = useCallback(
    (memo: MemoRow) => {
      const nextEditor = createEditor('memo', {
        memoId: memo.id,
        mode: 'existing',
      });

      setIsSplitWorkspaceEnabled(true);
      setSplitPanes(previous => {
        if (previous.length === 0) {
          const nextPane: MemoSplitPaneState = {
            id: createSplitPaneId(),
            activeEditorId: nextEditor.id,
            editors: [nextEditor],
            ...mirrorEditorPatch(nextEditor),
            view: nextEditor.view,
          };
          setFocusedPaneId(nextPane.id);
          return [nextPane];
        }

        const targetPaneId =
          focusedPaneId && previous.some(pane => pane.id === focusedPaneId)
            ? focusedPaneId
            : previous[0].id;

        setFocusedPaneId(targetPaneId);
        return previous.map(pane => {
          if (pane.id !== targetPaneId) {
            return pane;
          }

          const editors = getAppPaneEditors(pane);

          // Already open in this pane → focus that tab instead of a duplicate.
          // The same memo may still be open once in the OTHER pane.
          const existingEditor = editors.find(
            editor => editor.view === 'memo' && editor.memoId === memo.id,
          );
          if (existingEditor) {
            return {
              ...pane,
              ...mirrorEditorPatch(existingEditor),
              activeEditorId: existingEditor.id,
              editors,
              view: existingEditor.view,
            };
          }

          return {
            ...pane,
            ...mirrorEditorPatch(nextEditor),
            activeEditorId: nextEditor.id,
            editors: editorsAfterOpenTab(
              editors,
              pane.activeEditorId,
              nextEditor,
            ),
            view: nextEditor.view,
          };
        });
      });
    },
    [
      focusedPaneId,
      setFocusedPaneId,
      setIsSplitWorkspaceEnabled,
      setSplitPanes,
    ],
  );

  return { openMemoInFocusedSplitPane };
};
