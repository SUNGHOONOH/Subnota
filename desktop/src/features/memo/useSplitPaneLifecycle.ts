import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import {
  createEditor,
  mirrorEditorPatch,
} from './memoSplitWorkspaceUtils';
import { createSplitPaneId } from './splitPaneState';

interface UseSplitPaneLifecycleOptions {
  focusedPaneId: string | null;
  maxPaneCount: number;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setIsSplitWorkspaceEnabled: Dispatch<SetStateAction<boolean>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPanes: MemoSplitPaneState[];
}

export const useSplitPaneLifecycle = ({
  focusedPaneId,
  maxPaneCount,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setSplitPanes,
  splitPanes,
}: UseSplitPaneLifecycleOptions) => {
  const handleChangePane = useCallback(
    (id: string, patch: Partial<MemoSplitPaneState>) => {
      setSplitPanes(previous =>
        previous.map(pane =>
          pane.id === id ? { ...pane, ...patch } : pane,
        ),
      );
    },
    [setSplitPanes],
  );

  const handleAddSplitPane = useCallback(() => {
    if (splitPanes.length >= maxPaneCount) {
      return;
    }

    const nextEditor = createEditor('memo', { isViewPicker: true });
    const nextPane: MemoSplitPaneState = {
      id: createSplitPaneId(),
      activeEditorId: nextEditor.id,
      editors: [nextEditor],
      ...mirrorEditorPatch(nextEditor),
      view: nextEditor.view,
    };

    setIsSplitWorkspaceEnabled(true);
    setFocusedPaneId(nextPane.id);
    setSplitPanes(previous => {
      if (previous.length >= maxPaneCount) {
        return previous;
      }

      return [...previous, nextPane];
    });
  }, [maxPaneCount, setFocusedPaneId, setIsSplitWorkspaceEnabled, setSplitPanes, splitPanes.length]);

  const handleClosePane = useCallback(
    (id: string) => {
      const next = splitPanes.filter(pane => pane.id !== id);

      if (next.length === 0) {
        const nextEditor = createEditor('memo', { isViewPicker: true });
        const nextPane: MemoSplitPaneState = {
          id: createSplitPaneId(),
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
          ...mirrorEditorPatch(nextEditor),
          view: nextEditor.view,
        };
        setSplitPanes([nextPane]);
        setIsSplitWorkspaceEnabled(true);
        setFocusedPaneId(nextPane.id);
        return;
      }

      setSplitPanes(next);
      if (focusedPaneId === id) {
        setFocusedPaneId(next[next.length - 1].id);
      }
    },
    [
      focusedPaneId,
      setFocusedPaneId,
      setIsSplitWorkspaceEnabled,
      setSplitPanes,
      splitPanes,
    ],
  );

  const handleCloseAllPanes = useCallback(() => {
    const nextEditor = createEditor('memo', { isViewPicker: true });
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
  }, [setFocusedPaneId, setIsSplitWorkspaceEnabled, setSplitPanes]);

  return {
    handleAddSplitPane,
    handleChangePane,
    handleCloseAllPanes,
    handleClosePane,
  };
};
