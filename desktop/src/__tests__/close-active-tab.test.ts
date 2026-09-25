import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useCloseActiveTab.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('close active split-pane tab action', () => {
  it('uses the focused pane or first pane fallback and no-ops when absent', () => {
    expect(source).toContain(
      'splitPanes.find(candidate => candidate.id === focusedPaneId)',
    );
    expect(source).toContain('splitPanes[0]');
    expect(source).toContain('if (!pane) return;');
  });

  it('delegates the last tab to pane lifecycle close behavior', () => {
    expect(source).toContain('if (editors.length <= 1)');
    expect(source).toContain('handleClosePane(pane.id);');
  });

  it('uses the shared close rule for a pane with multiple tabs', () => {
    expect(source).toContain('editorsAfterCloseTab(');
    expect(source).toContain('activeEditor.id, activeEditor.id');
    expect(source).toContain('if (!nextEditor) return;');
  });

  it('selects the next memo and mirrors the active editor', () => {
    expect(source).toContain('if (nextEditor.memoId)');
    expect(source).toContain('onSelectMemoById(nextEditor.memoId);');
    expect(source).toContain('...mirrorEditorPatch(nextEditor)');
    expect(source).toContain('activeEditorId: nextEditor.id');
    expect(source).toContain('editors: nextEditors');
  });

  it('keeps App wired to the extracted close action', () => {
    expect(appSource).toContain(
      'const { closeActiveTab } = useCloseActiveTab({',
    );
    expect(appSource).not.toContain('const closeActiveTab = () => {');
    expect(appSource).toContain('closeActiveTab,');
  });
});
