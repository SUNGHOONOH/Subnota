import { describe, expect, it } from 'vitest';

import {
  getAppActiveEditor,
  getAppPaneEditors,
} from '../features/memo/splitPaneState';
import type { MemoSplitPaneState } from '../features/memo/components/MemoSplitWorkspace';

const pane: MemoSplitPaneState = {
  activeEditorId: 'second',
  editors: [
    { id: 'first', view: 'memo' },
    { id: 'second', view: 'inbox' },
  ],
  id: 'pane',
  view: 'memo',
};

describe('split pane state', () => {
  it('uses the tab collection and returns the active tab', () => {
    expect(getAppPaneEditors(pane).map((editor) => editor.id)).toEqual([
      'first',
      'second',
    ]);
    expect(getAppActiveEditor(pane)?.id).toBe('second');
  });

  it('supports the legacy single-pane shape and falls back to its first tab', () => {
    const legacyPane: MemoSplitPaneState = {
      activeEditorId: 'missing',
      id: 'legacy',
      view: 'calendar',
    };

    expect(getAppPaneEditors(legacyPane)).toEqual([legacyPane]);
    expect(getAppActiveEditor(legacyPane)).toBe(legacyPane);
  });
});
