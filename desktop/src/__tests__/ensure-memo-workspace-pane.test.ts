import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useEnsureMemoWorkspacePane.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('ensure memo workspace pane effect', () => {
  it('only seeds a pane while memo view is active and no pane exists', () => {
    expect(source).toContain("if (activeTab !== 'memo' || splitPaneCount > 0)");
    expect(source).toContain('return;');
  });

  it('prefers the active memo and falls back to the first memo', () => {
    expect(source).toContain('const seedMemo = activeMemo ?? memos[0] ?? null;');
    expect(source).toContain('memoId: seedMemo.id');
    expect(source).toContain("mode: 'existing'");
  });

  it('creates a pane with the shared editor mirror fields', () => {
    expect(source).toContain("const nextEditor = createEditor(");
    expect(source).toContain('id: createSplitPaneId()');
    expect(source).toContain('...mirrorEditorPatch(nextEditor)');
    expect(source).toContain('editors: [nextEditor]');
  });

  it('enables and focuses the restored pane in the existing order', () => {
    expect(source).toContain('setIsSplitWorkspaceEnabled(true);');
    expect(source).toContain('setSplitPanes([nextPane]);');
    expect(source).toContain('setFocusedPaneId(nextPane.id);');
  });

  it('keeps the original effect dependency values through the extracted hook', () => {
    expect(source).toContain(
      '[activeMemo, activeTab, memos, setFocusedPaneId, setIsSplitWorkspaceEnabled, setSplitPanes, splitPaneCount]',
    );
    expect(appSource).toContain(
      'useEnsureMemoWorkspacePane({',
    );
    expect(appSource).toContain('splitPaneCount: splitPanes.length');
    expect(appSource).not.toContain('useEffect(() => {\n    if (activeTab !== \'memo\'');
  });
});
