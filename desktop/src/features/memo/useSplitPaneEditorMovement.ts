import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import { mirrorEditorPatch } from './memoSplitWorkspaceUtils';
import { getAppPaneEditors } from './splitPaneState';
import {
  editorsAfterCloseTab,
  editorsAfterMove,
  editorsAfterTransfer,
} from '../../lib/splitPaneTabs';

interface UseSplitPaneEditorMovementOptions {
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
}

export const useSplitPaneEditorMovement = ({
  setFocusedPaneId,
  setSplitPanes,
}: UseSplitPaneEditorMovementOptions) => {
  const handleMoveEditor = useCallback(
    (
      sourcePaneId: string,
      targetPaneId: string,
      editorId: string,
      targetIndex: number,
    ) => {
      setSplitPanes(previous => {
        const sourcePane = previous.find(pane => pane.id === sourcePaneId);
        const targetPane = previous.find(pane => pane.id === targetPaneId);
        if (!sourcePane || !targetPane) {
          return previous;
        }

        const sourceEditors = getAppPaneEditors(sourcePane);
        if (sourcePaneId === targetPaneId) {
          return previous.map(pane =>
            pane.id === sourcePaneId
              ? {
                  ...pane,
                  editors: editorsAfterMove(sourceEditors, editorId, targetIndex),
                }
              : pane,
          );
        }

        const movedEditor = sourceEditors.find(editor => editor.id === editorId);
        if (!movedEditor) {
          return previous;
        }

        const {
          sourceEditors: nextSourceEditors,
          targetEditors: nextTargetEditors,
        } = editorsAfterTransfer(
          sourceEditors,
          getAppPaneEditors(targetPane),
          editorId,
          targetIndex,
        );
        const { activeEditor: nextSourceEditor } = editorsAfterCloseTab(
          sourceEditors,
          sourcePane.activeEditorId,
          editorId,
        );

        return previous
          .filter(
            pane => pane.id !== sourcePaneId || nextSourceEditors.length > 0,
          )
          .map(pane => {
            if (pane.id === targetPaneId) {
              return {
                ...pane,
                ...mirrorEditorPatch(movedEditor),
                activeEditorId: movedEditor.id,
                editors: nextTargetEditors,
              };
            }

            if (pane.id === sourcePaneId && nextSourceEditor) {
              return {
                ...pane,
                ...mirrorEditorPatch(nextSourceEditor),
                activeEditorId: nextSourceEditor.id,
                editors: nextSourceEditors,
              };
            }

            return pane;
          });
      });
      setFocusedPaneId(targetPaneId);
    },
    [setFocusedPaneId, setSplitPanes],
  );

  return { handleMoveEditor };
};
