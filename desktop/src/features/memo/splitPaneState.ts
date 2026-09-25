import type { MemoSplitPaneState } from './components/MemoSplitWorkspace';

export const createSplitPaneId = () =>
  `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getAppPaneEditors = (pane: MemoSplitPaneState) =>
  pane.editors && pane.editors.length > 0 ? pane.editors : [pane];

export const getAppActiveEditor = (pane: MemoSplitPaneState) => {
  const editors = getAppPaneEditors(pane);
  return (
    editors.find((editor) => editor.id === pane.activeEditorId) ?? editors[0]
  );
};
