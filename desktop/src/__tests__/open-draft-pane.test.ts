import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useOpenDraftInFocusedSplitPane.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('open draft in focused split pane action', () => {
  it('creates a draft editor with an empty body and selected category', () => {
    expect(source).toContain("createEditor('memo', {");
    expect(source).toContain('draftCategory: category');
    expect(source).toContain("draftText: ''");
    expect(source).toContain("mode: 'draft'");
  });

  it('resets the active draft state before opening the pane', () => {
    expect(source).toContain("setActiveTab('memo');");
    expect(source).toContain('setActiveMemoId(null);');
    expect(source).toContain('setActiveMemoCreatedAt(new Date().toISOString());');
    expect(source).toContain('setActiveDraftCategory(category);');
    expect(source).toContain('setAmbientResult(null);');
  });

  it('creates and focuses a pane when none exists', () => {
    expect(source).toContain('if (previous.length === 0)');
    expect(source).toContain('id: createSplitPaneId()');
    expect(source).toContain('setFocusedPaneId(nextPane.id);');
    expect(source).toContain('return [nextPane];');
  });

  it('uses the focused pane or first pane fallback', () => {
    expect(source).toContain(
      'focusedPaneId && previous.some(pane => pane.id === focusedPaneId)',
    );
    expect(source).toContain(': previous[0].id;');
    expect(source).toContain('setFocusedPaneId(targetPaneId);');
  });

  it('appends only when forceNewTab is requested', () => {
    expect(source).toContain('forceNewTab');
    expect(source).toContain('editorsAfterNewTab(');
    expect(source).toContain('editorsAfterOpenTab(');
  });

  it('keeps App wired to the extracted draft action', () => {
    expect(appSource).toContain(
      'const { openDraftInFocusedSplitPane } = useOpenDraftInFocusedSplitPane({',
    );
    expect(appSource).not.toContain(
      'const openDraftInFocusedSplitPane = (',
    );
    expect(appSource).toContain(
      'createMemo: () => openDraftInFocusedSplitPane()',
    );
    expect(appSource).toContain('openDraftInFocusedSplitPane();');
  });
});
