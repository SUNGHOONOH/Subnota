import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useWorkspaceLoader.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('workspace loader boundary', () => {
  it('keeps App with loader hook wiring only', () => {
    expect(appSource).toContain(
      "import { useWorkspaceLoader } from './features/workspace/useWorkspaceLoader';",
    );
    expect(appSource).toContain('useWorkspaceLoader({');
    expect(appSource).not.toContain('const loadWorkspace = useCallback');
  });

  it('upserts the profile, flushes local outbox, and rejects stale loads', () => {
    expect(source).toContain('await ensureProfile(currentSession.user.id);');
    expect(source).toContain(
      'await syncPendingLocalWorkspace(currentSession);',
    );
    expect(source).toContain('const isCurrentLoad = () =>');
    expect(source).toContain('if (!isCurrentLoad())');
  });

  it('fetches remote workspace domains concurrently with safe null fallbacks', () => {
    expect(source).toContain('await Promise.all([');
    expect(source).toContain('fetchInboxSessions(currentSession).catch(() => null)');
    expect(source).toContain('fetchMemoFolders(currentSession).catch(() => null)');
    expect(source).toContain('fetchTopicMap(currentSession).catch(');
  });

  it('protects active and pending memos while merging remote snapshots', () => {
    expect(source).toContain('activeMemoIdsInPanes(splitPanesRef.current)');
    expect(source).toContain(
      'replaceSyncedMemos(visibleRemoteMemos, ownerId, protectedMemoIds)',
    );
    expect(source).toContain('restoreLocalMemoSnapshotAfterPull(memo, ownerId)');
    expect(source).toMatch(
      /mergeLoadedMemosPreservingLocalWrites\([\s\S]*?latestPendingLocalWriteIds,[\s\S]*?latestActiveEditorMemoIds/,
    );
  });

  it('preserves Inbox, Topic, and folder tombstones and records sync completion', () => {
    expect(source).toContain('collectPendingInboxDeletes(latestLocalInbox)');
    expect(source).toContain('withoutDeletedPendingInboxItems(');
    expect(source).toContain('await saveLocalTopicMap(nextTopicMap, ownerId);');
    expect(source).toContain("action.kind === 'delete_folder'");
    expect(source).toContain(
      'window.localStorage?.setItem(lastSyncStorageKey, syncedAt);',
    );
    expect(source).toContain('await applyLocalWorkspace(ownerId);');
  });
});
