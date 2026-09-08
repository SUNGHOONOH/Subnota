import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useSplitPaneLifecycle.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('split pane lifecycle actions', () => {
  it('updates only the requested pane', () => {
    expect(source).toContain('previous.map(pane =>');
    expect(source).toContain('pane.id === id ? { ...pane, ...patch } : pane');
  });

  it('honors the maximum pane count before and during creation', () => {
    expect(source.match(/previous\.length >= maxPaneCount/g)).toHaveLength(1);
    expect(source).toContain('splitPanes.length >= maxPaneCount');
  });

  it('creates a view-picker editor for a new pane', () => {
    expect(source).toContain("createEditor('memo', { isViewPicker: true })");
    expect(source).toContain('setFocusedPaneId(nextPane.id);');
    expect(source).toContain('return [...previous, nextPane];');
  });

  it('restores a view-picker pane when the last pane closes', () => {
    expect(source).toContain('if (next.length === 0)');
    expect(source).toContain('setSplitPanes([nextPane]);');
    expect(source).toContain('setIsSplitWorkspaceEnabled(true);');
  });

  it('focuses the last remaining pane when the focused pane closes', () => {
    expect(source).toContain('if (focusedPaneId === id)');
    expect(source).toContain('setFocusedPaneId(next[next.length - 1].id);');
  });

  it('keeps App wired to the extracted lifecycle actions', () => {
    expect(appSource).toContain(
      'const {\n    handleAddSplitPane,\n    handleChangePane,\n    handleCloseAllPanes,\n    handleClosePane,\n  } = useSplitPaneLifecycle({',
    );
    expect(appSource).toContain('maxPaneCount: MAX_SPLIT_PANE_COUNT');
  });
});
