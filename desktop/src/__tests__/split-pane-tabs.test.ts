import { describe, expect, it } from 'vitest';

import {
  activeMemoIdsInPanes,
  editorAtRelativeTab,
  editorsAfterCloseTab,
  editorsAfterMove,
  editorsAfterNewTab,
  editorsAfterOpenSource,
  editorsAfterOpenTab,
  editorsAfterTransfer,
} from '../lib/splitPaneTabs';
import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
} from '../features/memo/components/MemoSplitWorkspace';
import type { NetworkSearchResult } from '../services/backend/networkService';

const networkTab: MemoSplitEditorState = { id: 'tab-network', view: 'network' };
const memoTab: MemoSplitEditorState = {
  id: 'tab-memo',
  memoId: 'memo-1',
  mode: 'existing',
  view: 'memo',
};
const nextEditor: MemoSplitEditorState = {
  id: 'tab-next',
  memoId: 'memo-2',
  mode: 'existing',
  view: 'memo',
};

describe('editorsAfterOpenTab', () => {
  it('keeps the network tab and appends the memo as a new tab', () => {
    // Bug repro: "새 탭으로 노트 열기" from the network view used to replace
    // the network tab itself with the memo editor.
    const result = editorsAfterOpenTab([networkTab], 'tab-network', nextEditor);

    expect(result).toEqual([networkTab, nextEditor]);
  });

  it('keeps a topics tab too', () => {
    // Bug repro: clicking a memo in the topic folder replaced the Topics tab.
    const topicsTab: MemoSplitEditorState = { id: 'tab-topics', view: 'topics' };

    const result = editorsAfterOpenTab(
      [memoTab, topicsTab],
      'tab-topics',
      nextEditor,
    );

    expect(result).toEqual([memoTab, topicsTab, nextEditor]);
  });

  it('appends a source tab instead of hijacking the network tab', () => {
    const sourceTab: MemoSplitEditorState = { id: 'tab-source', view: 'source' };

    const result = editorsAfterOpenTab([networkTab], 'tab-network', sourceTab);

    expect(result).toEqual([networkTab, sourceTab]);
  });

  it('replaces the active tab when it is a memo tab', () => {
    const result = editorsAfterOpenTab(
      [memoTab, networkTab],
      'tab-memo',
      nextEditor,
    );

    expect(result).toEqual([nextEditor, networkTab]);
  });

  it('returns just the new editor when the pane has no tabs', () => {
    expect(editorsAfterOpenTab([], undefined, nextEditor)).toEqual([nextEditor]);
  });

  it('falls back to the first tab when the active id is unknown', () => {
    const result = editorsAfterOpenTab([memoTab], 'missing', nextEditor);

    expect(result).toEqual([nextEditor]);
  });
});

describe('editorsAfterNewTab', () => {
  it('always preserves the active memo tab and appends the new tab', () => {
    expect(editorsAfterNewTab([memoTab], nextEditor)).toEqual([
      memoTab,
      nextEditor,
    ]);
  });
});

describe('editorAtRelativeTab', () => {
  it('cycles tabs within the current pane in either direction', () => {
    const editors = [memoTab, networkTab, nextEditor];

    expect(editorAtRelativeTab(editors, networkTab.id, 1)).toBe(nextEditor);
    expect(editorAtRelativeTab(editors, networkTab.id, -1)).toBe(memoTab);
    expect(editorAtRelativeTab(editors, nextEditor.id, 1)).toBe(memoTab);
  });
});

describe('activeMemoIdsInPanes', () => {
  it('protects only the live memo editor in each pane', () => {
    const backgroundMemo: MemoSplitEditorState = {
      id: 'tab-background',
      memoId: 'memo-background',
      mode: 'existing',
      view: 'memo',
    };
    const panes: MemoSplitPaneState[] = [
      {
        activeEditorId: memoTab.id,
        editors: [backgroundMemo, memoTab],
        id: 'pane-a',
        view: 'memo',
      },
      {
        activeEditorId: networkTab.id,
        editors: [nextEditor, networkTab],
        id: 'pane-b',
        view: 'network',
      },
    ];

    expect([...activeMemoIdsInPanes(panes)]).toEqual(['memo-1']);
  });

  it('supports the legacy pane-as-editor shape', () => {
    expect([
      ...activeMemoIdsInPanes([
        {
          id: 'pane-a',
          memoId: 'memo-legacy',
          mode: 'existing',
          view: 'memo',
        },
      ]),
    ]).toEqual(['memo-legacy']);
  });
});

describe('tab moves', () => {
  it('reorders a tab within its pane', () => {
    expect(editorsAfterMove([memoTab, networkTab, nextEditor], memoTab.id, 3)).toEqual([
      networkTab,
      nextEditor,
      memoTab,
    ]);
  });

  it('moves a tab into the requested position in another pane', () => {
    expect(editorsAfterTransfer([memoTab, networkTab], [nextEditor], networkTab.id, 0)).toEqual({
      sourceEditors: [memoTab],
      targetEditors: [networkTab, nextEditor],
    });
  });
});

describe('editorsAfterCloseTab', () => {
  it('returns an empty pane when its last tab is closed', () => {
    expect(editorsAfterCloseTab([memoTab], memoTab.id, memoTab.id)).toEqual({
      activeEditor: null,
      editors: [],
    });
  });

  it('selects the nearest remaining tab when the active tab closes', () => {
    const result = editorsAfterCloseTab(
      [memoTab, networkTab, nextEditor],
      networkTab.id,
      networkTab.id,
    );

    expect(result.editors).toEqual([memoTab, nextEditor]);
    expect(result.activeEditor).toBe(nextEditor);
  });

  it('keeps the active tab when a background tab closes', () => {
    const result = editorsAfterCloseTab(
      [memoTab, networkTab],
      memoTab.id,
      networkTab.id,
    );

    expect(result.editors).toEqual([memoTab]);
    expect(result.activeEditor).toBe(memoTab);
  });
});

const sourceResult = (inboxSessionId: string): NetworkSearchResult => ({
  chunkId: `inbox-${inboxSessionId}`,
  chunkText: '',
  createdAt: null,
  endIndex: 0,
  inboxSessionId,
  memoContent: null,
  memoCreatedAt: null,
  memoId: null,
  memoUpdatedAt: null,
  similarity: 0,
  sourceKind: 'inbox',
  sourceLabel: null,
  sourceType: 'url',
  sourceUrl: null,
  startIndex: 0,
  thumbnailUrl: null,
  title: null,
});

describe('editorsAfterOpenSource', () => {
  const sourceTab: MemoSplitEditorState = {
    id: 'tab-source',
    sourceResult: sourceResult('inbox-1'),
    view: 'source',
  };

  it('appends a new tab instead of replacing the active memo tab', () => {
    // Bug repro: opening a link detail from a memo tab replaced that memo tab.
    const next: MemoSplitEditorState = {
      id: 'tab-new-source',
      sourceResult: sourceResult('inbox-2'),
      view: 'source',
    };

    const result = editorsAfterOpenSource([memoTab], next);

    expect(result.editors).toEqual([memoTab, next]);
    expect(result.activeEditor).toBe(next);
  });

  it('focuses the existing tab for the same inbox item instead of duplicating', () => {
    const duplicate: MemoSplitEditorState = {
      id: 'tab-dup',
      sourceResult: sourceResult('inbox-1'),
      view: 'source',
    };

    const result = editorsAfterOpenSource([memoTab, sourceTab], duplicate);

    expect(result.editors).toEqual([memoTab, sourceTab]);
    expect(result.activeEditor).toBe(sourceTab);
  });
});
