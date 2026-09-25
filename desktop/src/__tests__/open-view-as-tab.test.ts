import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useOpenViewAsTab.ts'),
  'utf8',
);
const appSource = `${readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')}\n${readFileSync(
  resolve(__dirname, '../features/inbox/useInboxCaptureSubscription.ts'),
  'utf8',
)}`;

describe('open view as tab action', () => {
  it('refreshes Inbox only for Inbox views without awaiting the refresh', () => {
    expect(source).toContain("if (view === 'inbox')");
    expect(source).toContain('void onRefreshInbox();');
    expect(source).not.toContain('await onRefreshInbox');
  });

  it('creates and focuses a pane when no pane exists', () => {
    expect(source).toContain('if (splitPanes.length === 0)');
    expect(source).toContain('const paneId = createSplitPaneId();');
    expect(source).toContain('setSplitPanes([');
    expect(source).toContain('setFocusedPaneId(paneId);');
  });

  it('uses the focused pane or the existing last-pane fallback', () => {
    expect(source).toContain(
      'focusedPaneId && splitPanes.some(pane => pane.id === focusedPaneId)',
    );
    expect(source).toContain(': splitPanes[splitPanes.length - 1].id;');
  });

  it('focuses an existing view instead of stacking a duplicate', () => {
    expect(source).toContain(
      'editor.view === view',
    );
    expect(source).toContain('activeEditorId: existingEditor.id');
    expect(source).toContain('...mirrorEditorPatch(existingEditor)');
  });

  it('appends a new view and mirrors its active editor fields', () => {
    expect(source).toContain('editors: [...(pane.editors ?? []), newEditor]');
    expect(source).toContain('...mirrorEditorPatch(newEditor)');
    expect(source).toContain('activeEditorId: newEditor.id');
    expect(source).toContain('setFocusedPaneId(targetId);');
  });

  it('keeps App wiring, refs, and external callbacks intact', () => {
    expect(appSource).toContain('const { openViewAsTab } = useOpenViewAsTab({');
    expect(appSource).toContain('onRefreshInbox: refreshInbox');
    expect(appSource).not.toContain(
      'const openViewAsTab = (view: MemoSplitPaneView) => {',
    );
    expect(appSource).toContain("openViewAsTab('inbox')");
    expect(appSource).toContain('onOpenCalendar={() => openViewAsTab(\'calendar\')}');
  });
});
