import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
} from '../features/memo/components/MemoSplitWorkspace';

export const activeMemoIdsInPanes = (
  panes: readonly MemoSplitPaneState[],
): ReadonlySet<string> => {
  const memoIds = new Set<string>();

  for (const pane of panes) {
    const editors = pane.editors?.length ? pane.editors : [pane];
    const active =
      editors.find(editor => editor.id === pane.activeEditorId) ?? editors[0];
    if (active?.view === 'memo' && active.memoId) {
      memoIds.add(active.memoId);
    }
  }

  return memoIds;
};

// Opening content (a memo, a draft, a source detail) from a memo tab replaces
// that tab (preview-style reuse). From any non-memo view tab
// (network/topics/…) the view must survive — "새 탭으로 노트 열기" — so the
// content is appended as a genuinely new tab.
export const editorsAfterOpenTab = (
  editors: MemoSplitEditorState[],
  activeEditorId: string | undefined,
  nextEditor: MemoSplitEditorState,
): MemoSplitEditorState[] => {
  if (editors.length === 0) {
    return [nextEditor];
  }

  const active =
    editors.find(editor => editor.id === activeEditorId) ?? editors[0];

  if (active.view !== 'memo') {
    return [...editors, nextEditor];
  }

  return editors.map(editor => (editor.id === active.id ? nextEditor : editor));
};

// Explicitly creating a new tab must never consume the active tab, including
// when that tab is a memo. This is used by the memo rail's second click.
export const editorsAfterNewTab = (
  editors: MemoSplitEditorState[],
  nextEditor: MemoSplitEditorState,
): MemoSplitEditorState[] => [...editors, nextEditor];

export const editorAtRelativeTab = (
  editors: MemoSplitEditorState[],
  activeEditorId: string | undefined,
  offset: number,
): MemoSplitEditorState | null => {
  if (editors.length === 0) return null;

  const activeIndex = Math.max(
    0,
    editors.findIndex(editor => editor.id === activeEditorId),
  );
  return editors[(activeIndex + offset + editors.length) % editors.length];
};

export const editorsAfterMove = (
  editors: MemoSplitEditorState[],
  editorId: string,
  targetIndex: number,
): MemoSplitEditorState[] => {
  const sourceIndex = editors.findIndex(editor => editor.id === editorId);
  if (sourceIndex < 0) {
    return editors;
  }

  const editor = editors[sourceIndex];
  const nextEditors = editors.filter(candidate => candidate.id !== editorId);
  const insertIndex = Math.max(
    0,
    Math.min(
      targetIndex - (sourceIndex < targetIndex ? 1 : 0),
      nextEditors.length,
    ),
  );

  return [
    ...nextEditors.slice(0, insertIndex),
    editor,
    ...nextEditors.slice(insertIndex),
  ];
};

export const editorsAfterTransfer = (
  sourceEditors: MemoSplitEditorState[],
  targetEditors: MemoSplitEditorState[],
  editorId: string,
  targetIndex: number,
): {
  sourceEditors: MemoSplitEditorState[];
  targetEditors: MemoSplitEditorState[];
} => {
  const editor = sourceEditors.find(candidate => candidate.id === editorId);
  if (!editor) {
    return { sourceEditors, targetEditors };
  }

  const insertIndex = Math.max(0, Math.min(targetIndex, targetEditors.length));
  return {
    sourceEditors: sourceEditors.filter(candidate => candidate.id !== editorId),
    targetEditors: [
      ...targetEditors.slice(0, insertIndex),
      editor,
      ...targetEditors.slice(insertIndex),
    ],
  };
};

export const editorsAfterCloseTab = (
  editors: MemoSplitEditorState[],
  activeEditorId: string | undefined,
  editorId: string,
): {
  activeEditor: MemoSplitEditorState | null;
  editors: MemoSplitEditorState[];
} => {
  if (editors.length <= 1) {
    return { activeEditor: null, editors: [] };
  }

  const activeEditor =
    editors.find(editor => editor.id === activeEditorId) ?? editors[0];
  const closingIndex = editors.findIndex(editor => editor.id === editorId);
  const nextEditors = editors.filter(editor => editor.id !== editorId);
  const nextActiveEditor =
    activeEditor.id === editorId
      ? nextEditors[
          Math.max(0, Math.min(closingIndex, nextEditors.length - 1))
        ]
      : activeEditor;

  return { activeEditor: nextActiveEditor, editors: nextEditors };
};

// Web-summary (source) detail tabs never consume the tab they were opened
// from — not even a memo tab — and clicking the same saved link twice focuses
// the already-open tab instead of stacking duplicates.
export const editorsAfterOpenSource = (
  editors: MemoSplitEditorState[],
  nextEditor: MemoSplitEditorState,
): { activeEditor: MemoSplitEditorState; editors: MemoSplitEditorState[] } => {
  const sourceKey = (editor: MemoSplitEditorState) =>
    editor.sourceResult?.inboxSessionId ?? editor.sourceResult?.chunkId ?? null;

  const key = sourceKey(nextEditor);
  const existing = key
    ? editors.find(
        editor => editor.view === 'source' && sourceKey(editor) === key,
      )
    : undefined;

  if (existing) {
    return { activeEditor: existing, editors };
  }

  return { activeEditor: nextEditor, editors: [...editors, nextEditor] };
};
