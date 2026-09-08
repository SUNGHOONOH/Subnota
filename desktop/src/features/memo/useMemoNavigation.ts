import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { decideMemoNavAction } from '../../lib/memoNavAction';
import { DEFAULT_MEMO_CATEGORY } from '../../lib/memoCategory';
import type { TabKey } from '../../types';
import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';
import { mirrorEditorPatch } from './memoSplitWorkspaceUtils';
import { getAppActiveEditor, getAppPaneEditors } from './splitPaneState';

interface UseMemoNavigationOptions {
  activeTab: TabKey;
  focusedPaneId: string | null;
  onOpenDraftInFocusedSplitPane: (
    category?: string,
    forceNewTab?: boolean,
  ) => void;
  onSelectMemoById: (memoId: string) => void;
  setActiveDraftCategory: Dispatch<SetStateAction<string>>;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setActiveMemoId: Dispatch<SetStateAction<string | null>>;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPanes: MemoSplitPaneState[];
}

export const useMemoNavigation = ({
  activeTab,
  focusedPaneId,
  onOpenDraftInFocusedSplitPane,
  onSelectMemoById,
  setActiveDraftCategory,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setActiveTab,
  setFocusedPaneId,
  setSplitPanes,
  splitPanes,
}: UseMemoNavigationOptions) => {
  const handleMemoNavClick = useCallback(() => {
    const focusedPane = splitPanes.find(pane => pane.id === focusedPaneId);
    const memoTabs = splitPanes.flatMap(pane =>
      getAppPaneEditors(pane)
        .filter(editor => editor.view === 'memo')
        .map(editor => ({ editor, pane })),
    );
    const focusedEditor = focusedPane
      ? getAppActiveEditor(focusedPane)
      : undefined;
    const action = decideMemoNavAction({
      hasMemoTab: memoTabs.length > 0,
      isMemoTabFocused: activeTab === 'memo' && focusedEditor?.view === 'memo',
    });

    if (action === 'create-new') {
      onOpenDraftInFocusedSplitPane(DEFAULT_MEMO_CATEGORY, true);
      return;
    }

    // Prefer a memo tab in the currently focused panel; otherwise use the
    // first memo tab in panel order so the rail always has a deterministic
    // target to focus.
    const target =
      (focusedPane
        ? memoTabs.find(item => item.pane.id === focusedPane.id)
        : undefined) ?? memoTabs[0];
    if (!target) {
      onOpenDraftInFocusedSplitPane(DEFAULT_MEMO_CATEGORY, true);
      return;
    }

    setActiveTab('memo');
    setFocusedPaneId(target.pane.id);
    if (target.editor.memoId) {
      onSelectMemoById(target.editor.memoId);
    } else {
      setActiveMemoId(null);
      setActiveMemoCreatedAt(new Date().toISOString());
      setActiveDraftCategory(
        target.editor.draftCategory ?? DEFAULT_MEMO_CATEGORY,
      );
    }
    setSplitPanes(previous =>
      previous.map(pane => {
        if (pane.id !== target.pane.id) {
          return pane;
        }
        return {
          ...pane,
          ...mirrorEditorPatch(target.editor),
          activeEditorId: target.editor.id,
          editors: getAppPaneEditors(pane),
          view: target.editor.view,
        };
      }),
    );
  }, [
    activeTab,
    focusedPaneId,
    onOpenDraftInFocusedSplitPane,
    onSelectMemoById,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setActiveTab,
    setFocusedPaneId,
    setSplitPanes,
    splitPanes,
  ]);

  return { handleMemoNavClick };
};
