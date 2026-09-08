import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useOpenNewTab.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('open new tab action', () => {
  it('creates a memo view picker and activates the memo workspace', () => {
    expect(source).toContain(
      "createEditor('memo', { isViewPicker: true })",
    );
    expect(source).toContain("setActiveTab('memo');");
    expect(source).toContain('setIsSplitWorkspaceEnabled(true);');
  });

  it('creates and focuses a pane when none exists', () => {
    expect(source).toContain('if (splitPanes.length === 0)');
    expect(source).toContain('const paneId = createSplitPaneId();');
    expect(source).toContain('setSplitPanes([');
    expect(source).toContain('setFocusedPaneId(paneId);');
  });

  it('appends to the focused pane and falls back to the first pane', () => {
    expect(source).toContain(
      'focusedPaneId && splitPanes.some(pane => pane.id === focusedPaneId)',
    );
    expect(source).toContain(': splitPanes[0].id;');
    expect(source).toContain(
      'editorsAfterNewTab(getAppPaneEditors(pane), nextEditor)',
    );
  });

  it('focuses the pane receiving the new tab', () => {
    expect(source).toContain('setFocusedPaneId(targetPaneId);');
  });

  it('keeps App wired to the extracted action hook', () => {
    expect(appSource).toContain(
      'const { openNewTabInFocusedSplitPane } = useOpenNewTab({',
    );
    expect(appSource).not.toContain(
      'const openNewTabInFocusedSplitPane = () => {',
    );
    expect(appSource).toContain('onOpenNewTab={openNewTabInFocusedSplitPane}');
  });
});
