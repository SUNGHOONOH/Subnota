import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useOpenMemoInFocusedSplitPane.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('open memo in focused split pane action', () => {
  it('creates an existing memo editor', () => {
    expect(source).toContain("createEditor('memo', {");
    expect(source).toContain('memoId: memo.id');
    expect(source).toContain("mode: 'existing'");
  });

  it('creates and focuses a pane when no pane exists', () => {
    expect(source).toContain('if (previous.length === 0)');
    expect(source).toContain('id: createSplitPaneId()');
    expect(source).toContain('setFocusedPaneId(nextPane.id);');
    expect(source).toContain('return [nextPane];');
  });

  it('uses the focused pane or deterministically falls back to the first pane', () => {
    expect(source).toContain(
      'focusedPaneId && previous.some(pane => pane.id === focusedPaneId)',
    );
    expect(source).toContain(': previous[0].id;');
    expect(source).toContain('setFocusedPaneId(targetPaneId);');
  });

  it('focuses an existing memo in the target pane without duplicating it', () => {
    expect(source).toContain(
      "editor.view === 'memo' && editor.memoId === memo.id",
    );
    expect(source).toContain('activeEditorId: existingEditor.id');
  });

  it('allows the same memo in another pane and applies the open-tab rule', () => {
    expect(source).toContain('editorsAfterOpenTab(');
    expect(source).toContain('pane.activeEditorId');
    expect(source).toContain('nextEditor');
    expect(source).toContain('setIsSplitWorkspaceEnabled(true);');
  });

  it('keeps App wired to the extracted action hook', () => {
    expect(appSource).toContain(
      'const { openMemoInFocusedSplitPane } = useOpenMemoInFocusedSplitPane({',
    );
    expect(appSource).not.toContain(
      'const openMemoInFocusedSplitPane = (memo: MemoRow) => {',
    );
  });
});
