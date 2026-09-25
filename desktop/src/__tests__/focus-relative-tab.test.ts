import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useRelativeTabFocus.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('relative split-pane tab focus action', () => {
  it('uses the focused pane and falls back to the first pane', () => {
    expect(source).toContain(
      'splitPanes.find(candidate => candidate.id === focusedPaneId)',
    );
    expect(source).toContain('splitPanes[0]');
    expect(source).toContain('if (!pane) return;');
  });

  it('gets the next editor through the shared relative-tab rule', () => {
    expect(source).toContain('editorAtRelativeTab(');
    expect(source).toContain('pane.activeEditorId');
    expect(source).toContain('offset');
    expect(source).toContain('if (!nextEditor) return;');
  });

  it('activates the memo workspace before selecting the memo', () => {
    expect(source).toContain("setActiveTab('memo');");
    expect(source).toContain('setFocusedPaneId(pane.id);');
    expect(source).toContain('if (nextEditor.memoId)');
    expect(source).toContain('onSelectMemoById(nextEditor.memoId);');
  });

  it('mirrors and activates the selected editor in its pane', () => {
    expect(source).toContain('...mirrorEditorPatch(nextEditor)');
    expect(source).toContain('activeEditorId: nextEditor.id');
    expect(source).toContain('editors: getAppPaneEditors(candidate)');
  });

  it('keeps both keyboard directions wired in App', () => {
    expect(appSource).toContain(
      'const { focusRelativeTab } = useRelativeTabFocus({',
    );
    expect(appSource).not.toContain('const focusRelativeTab = (offset: number) => {');
    expect(appSource).toContain('focusNextTab: () => focusRelativeTab(1)');
    expect(appSource).toContain('focusPreviousTab: () => focusRelativeTab(-1)');
  });
});
