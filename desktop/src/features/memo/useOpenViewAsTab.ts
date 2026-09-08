import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { TabKey } from '../../types';
import type {
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './components/MemoSplitWorkspace';
import { createEditor, mirrorEditorPatch } from './memoSplitWorkspaceUtils';
import { createSplitPaneId } from './splitPaneState';

interface UseOpenViewAsTabOptions {
  focusedPaneId: string | null;
  onRefreshInbox: () => void | Promise<unknown>;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setFocusedPaneId: Dispatch<SetStateAction<string | null>>;
  setIsSplitWorkspaceEnabled: Dispatch<SetStateAction<boolean>>;
  setSplitPanes: Dispatch<SetStateAction<MemoSplitPaneState[]>>;
  splitPanes: MemoSplitPaneState[];
}

export const useOpenViewAsTab = ({
  focusedPaneId,
  onRefreshInbox,
  setActiveTab,
  setFocusedPaneId,
  setIsSplitWorkspaceEnabled,
  setSplitPanes,
  splitPanes,
}: UseOpenViewAsTabOptions) => {
  const openViewAsTab = useCallback(
    (view: MemoSplitPaneView) => {
      setIsSplitWorkspaceEnabled(true);
      setActiveTab('memo');
      if (view === 'inbox') {
        // stale-while-revalidate: 로컬 캐시가 먼저 그려지고, 열 때마다
        // 백그라운드에서 서버 목록으로 조용히 갱신한다.
        void onRefreshInbox();
      }
      const newEditor = createEditor(view);

      if (splitPanes.length === 0) {
        const paneId = createSplitPaneId();
        setSplitPanes([
          {
            id: paneId,
            activeEditorId: newEditor.id,
            editors: [newEditor],
            ...mirrorEditorPatch(newEditor),
            view: newEditor.view,
          },
        ]);
        setFocusedPaneId(paneId);
        return;
      }

      const targetId =
        focusedPaneId && splitPanes.some(pane => pane.id === focusedPaneId)
          ? focusedPaneId
          : splitPanes[splitPanes.length - 1].id;

      setSplitPanes(previous =>
        previous.map(pane => {
          if (pane.id !== targetId) {
            return pane;
          }

          // Same view already open in this pane → focus its tab instead of
          // stacking duplicate Topics/캘린더/... tabs on every ribbon click.
          const existingEditor = (pane.editors ?? []).find(
            editor => editor.view === view,
          );
          if (existingEditor) {
            return {
              ...pane,
              ...mirrorEditorPatch(existingEditor),
              activeEditorId: existingEditor.id,
              view: existingEditor.view,
            };
          }

          return {
            ...pane,
            ...mirrorEditorPatch(newEditor),
            activeEditorId: newEditor.id,
            editors: [...(pane.editors ?? []), newEditor],
            view: newEditor.view,
          };
        }),
      );
      setFocusedPaneId(targetId);
    },
    [
      focusedPaneId,
      onRefreshInbox,
      setActiveTab,
      setFocusedPaneId,
      setIsSplitWorkspaceEnabled,
      setSplitPanes,
      splitPanes,
    ],
  );

  return { openViewAsTab };
};
