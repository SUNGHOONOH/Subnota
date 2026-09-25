import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useLocalWorkspaceHydration.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('local workspace hydration boundary', () => {
  it('keeps App with local hydration hook wiring only', () => {
    expect(appSource).toContain(
      "import { useLocalWorkspaceHydration } from './features/workspace/useLocalWorkspaceHydration';",
    );
    expect(appSource).toContain('useLocalWorkspaceHydration({');
    expect(appSource).not.toContain('const localMemos,');
  });

  it('loads the local-first workspace domains concurrently', () => {
    expect(source).toContain('const [');
    expect(source).toContain('loadVisibleLocalMemos(effectiveOwnerId)');
    expect(source).toContain('loadVisibleLocalCalendarBlocks(effectiveOwnerId)');
    expect(source).toContain('loadLocalInboxItems(effectiveOwnerId)');
    expect(source).toContain('loadLocalScheduleInbox(effectiveOwnerId)');
    expect(source).toContain('loadLocalTopicMap(effectiveOwnerId)');
    expect(source).toContain('loadLocalMemoFolders(effectiveOwnerId)');
    expect(source).toContain('await Promise.all([');
  });

  it('rejects stale owner or load results before touching React state', () => {
    const guard = source.indexOf('if (\n        expectedWorkspaceLoadId');
    const firstStateWrite = source.indexOf('setMemos(visibleMemos)');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(firstStateWrite);
    expect(source).toContain('getLocalWorkspaceOwner() !== (effectiveOwnerId ?? null)');
  });

  it('preserves tombstone filtering, pending memo protection, and topic/folder application', () => {
    expect(source).toContain("item.local_sync_status === 'pending_delete'");
    expect(source).toContain('pendingMemoIdsForOwner(');
    expect(source).toContain('activeMemoIdsInPanes(splitPanesRef.current)');
    expect(source).toContain('withoutDeletedPendingInboxItems(');
    expect(source).toContain('applyTopicMap(localTopicMap);');
    expect(source).toContain('setMemoFolderMemberships(localMemoFolderMemberships);');
    expect(source).toContain('setMemoFolderExclusions(localMemoFolderExclusions);');
  });

  it('hydrates the active memo once and marks local workspace ready last', () => {
    expect(source).toContain('if (hasHydratedActiveMemoRef.current)');
    expect(source).toContain('setActiveMemoId(selectedMemo.id);');
    expect(source).toContain('hydrateActiveMemo(visibleMemos);');
    expect(source.lastIndexOf('setLocalWorkspaceReady(true);')).toBeGreaterThan(
      source.indexOf('hydrateActiveMemo(visibleMemos);'),
    );
  });
});
