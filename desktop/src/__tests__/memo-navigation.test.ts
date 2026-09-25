import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useMemoNavigation.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('memo navigation action', () => {
  it('derives the action from memo tab presence and current focus', () => {
    expect(source).toContain('getAppPaneEditors(pane)');
    expect(source).toContain("editor.view === 'memo'");
    expect(source).toContain('decideMemoNavAction({');
    expect(source).toContain('hasMemoTab: memoTabs.length > 0');
    expect(source).toContain(
      "isMemoTabFocused: activeTab === 'memo' && focusedEditor?.view === 'memo'",
    );
  });

  it('creates a forced new draft when no memo should be focused', () => {
    expect(source).toContain("if (action === 'create-new')");
    expect(source).toContain(
      'onOpenDraftInFocusedSplitPane(DEFAULT_MEMO_CATEGORY, true);',
    );
    expect(source).toContain('if (!target)');
  });

  it('prefers a memo in the focused pane and falls back to pane order', () => {
    expect(source).toContain(
      'memoTabs.find(item => item.pane.id === focusedPane.id)',
    );
    expect(source).toContain('?? memoTabs[0]');
  });

  it('selects existing memos and restores draft metadata separately', () => {
    expect(source).toContain('if (target.editor.memoId)');
    expect(source).toContain('onSelectMemoById(target.editor.memoId);');
    expect(source).toContain('setActiveMemoId(null);');
    expect(source).toContain('setActiveMemoCreatedAt(new Date().toISOString());');
    expect(source).toContain('target.editor.draftCategory');
    expect(source).toContain('DEFAULT_MEMO_CATEGORY');
  });

  it('mirrors the selected editor into the target pane', () => {
    expect(source).toContain('...mirrorEditorPatch(target.editor)');
    expect(source).toContain('activeEditorId: target.editor.id');
    expect(source).toContain('editors: getAppPaneEditors(pane)');
  });

  it('keeps the navigation rail wired to the extracted action', () => {
    expect(appSource).toContain(
      'const { handleMemoNavClick } = useMemoNavigation({',
    );
    expect(appSource).not.toContain('const handleMemoNavClick = () => {');
    expect(appSource).toContain('handleMemoNavClick={handleMemoNavClick}');
    expect(appSource).toContain('openMemos: handleMemoNavClick,');
  });
});
