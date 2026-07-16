import { describe, expect, it } from 'vitest';

import { normalizeWorkspaceSession } from '../lib/workspaceSession';

describe('workspace session persistence', () => {
  it('restores at most two panes and clears transient loading state', () => {
    const session = normalizeWorkspaceSession({
      activeMemoId: 'memo-2',
      activeTab: 'memo',
      focusedPaneId: 'pane-2',
      isSessionCollapsed: true,
      isSplitWorkspaceEnabled: true,
      paneWidths: {
        'pane-1': 35,
        'pane-2': 65,
        missing: 50,
      },
      splitPanes: [
        {
          activeEditorId: 'editor-1',
          editors: [
            {
              id: 'editor-1',
              memoId: 'memo-1',
              networkIsLoading: true,
              networkRequestId: 'request-1',
              view: 'memo',
            },
          ],
          id: 'pane-1',
          networkIsLoading: true,
          networkRequestId: 'request-1',
          view: 'memo',
        },
        { id: 'pane-2', view: 'calendar' },
        { id: 'pane-3', view: 'network' },
        { id: 'pane-4', view: 'briefing' },
      ],
      version: 1,
    });

    expect(session?.splitPanes).toHaveLength(2);
    expect(session?.focusedPaneId).toBe('pane-2');
    expect(session?.paneWidths).toEqual({ 'pane-1': 35, 'pane-2': 65 });
    expect(session?.splitPanes[0].networkIsLoading).toBe(false);
    expect(session?.splitPanes[0].networkRequestId).toBeUndefined();
    expect(session?.splitPanes[0].editors?.[0].networkIsLoading).toBe(false);
    expect(session?.splitPanes[0].editors?.[0].networkRequestId).toBeUndefined();
  });

  it('falls back to a valid focused pane and rejects malformed sessions', () => {
    const session = normalizeWorkspaceSession({
      activeMemoId: null,
      activeTab: 'memo',
      focusedPaneId: 'missing',
      isSessionCollapsed: false,
      isSplitWorkspaceEnabled: true,
      paneWidths: { 'pane-1': 8 },
      splitPanes: [{ id: 'pane-1', view: 'memo' }],
      version: 1,
    });

    expect(session?.focusedPaneId).toBe('pane-1');
    expect(session?.paneWidths).toEqual({});
    expect(normalizeWorkspaceSession({ version: 2 })).toBeNull();
  });
});
