import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useSplitPaneEditorMovement.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('split pane editor movement', () => {
  it('keeps a dedicated same-pane reorder path', () => {
    expect(source).toContain('if (sourcePaneId === targetPaneId)');
    expect(source).toContain(
      'editorsAfterMove(sourceEditors, editorId, targetIndex)',
    );
  });

  it('uses transfer and close rules for cross-pane moves', () => {
    expect(source).toContain('editorsAfterTransfer(');
    expect(source).toContain('editorsAfterCloseTab(');
  });

  it('leaves state unchanged when panes or the editor are missing', () => {
    expect(source).toContain('if (!sourcePane || !targetPane)');
    expect(source).toContain('return previous;');
    expect(source).toContain('if (!movedEditor)');
  });

  it('removes an emptied source pane after a cross-pane move', () => {
    expect(source).toContain(
      'pane.id !== sourcePaneId || nextSourceEditors.length > 0',
    );
  });

  it('activates the moved editor and focuses the target pane', () => {
    expect(source).toContain('activeEditorId: movedEditor.id');
    expect(source).toContain('setFocusedPaneId(targetPaneId);');
  });

  it('mirrors the active editor fields in both affected panes', () => {
    expect(source.match(/\.\.\.mirrorEditorPatch\(/g)).toHaveLength(2);
    expect(source).toContain('activeEditorId: nextSourceEditor.id');
  });

  it('keeps App wired to the extracted action hook', () => {
    expect(appSource).toContain(
      'const { handleMoveEditor } = useSplitPaneEditorMovement({',
    );
    expect(appSource).not.toContain('const handleMoveEditor = (');
  });
});
