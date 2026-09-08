import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import {
  createEditor,
  mirrorEditorPatch,
} from './memoSplitWorkspaceUtils';
import { createSplitPaneId } from './splitPaneState';
import { editorsAfterNewTab, editorsAfterOpenTab } from '../../lib/splitPaneTabs';
import { DEFAULT_MEMO_CATEGORY } from '../../lib/memoCategory';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { TabKey } from '../../types';

interface UseOpenDraftInFocusedSplitPaneOptions {
  focusedPaneId: string | null;
  setActiveDraftCategory: Dispatch<SetStateAction<string>>;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setActiveMemoId: Dispatch<SetStateAction<string | null>>;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setAmbientResult: Dispatch<SetStateAction<NetworkSearchResult | null>>;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setIsSplitWorkspaceEnabled: Dispatch<SetStateAction<boolean>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
}

export const useOpenDraftInFocusedSplitPane = ({
  focusedPaneId,
  setActiveDraftCategory,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setActiveTab,
  setAmbientResult,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setSplitPanes,
}: UseOpenDraftInFocusedSplitPaneOptions) => {
  const openDraftInFocusedSplitPane = useCallback(
    (category = DEFAULT_MEMO_CATEGORY, forceNewTab = false) => {
      const nextEditor = createEditor('memo', {
        draftCategory: category,
        draftText: '',
        mode: 'draft',
      });

      setActiveTab('memo');
      setActiveMemoId(null);
      setActiveMemoCreatedAt(new Date().toISOString());
      setActiveDraftCategory(category);
      setAmbientResult(null);
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

          const editors =
            pane.editors && pane.editors.length > 0 ? pane.editors : [pane];

          return {
            ...pane,
            ...mirrorEditorPatch(nextEditor),
            activeEditorId: nextEditor.id,
            editors: forceNewTab
              ? editorsAfterNewTab(editors, nextEditor)
              : editorsAfterOpenTab(editors, pane.activeEditorId, nextEditor),
            view: nextEditor.view,
          };
        });
      });
    },
    [
      focusedPaneId,
      setActiveDraftCategory,
      setActiveMemoCreatedAt,
      setActiveMemoId,
      setActiveTab,
      setAmbientResult,
      setFocusedPaneId,
      setIsSplitWorkspaceEnabled,
      setSplitPanes,
    ],
  );

  return { openDraftInFocusedSplitPane };
};
