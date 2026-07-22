import type { MemoSplitEditorState } from '../features/memo/components/MemoSplitWorkspace';

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
