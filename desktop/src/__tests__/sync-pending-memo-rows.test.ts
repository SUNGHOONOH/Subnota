import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const workspaceSource = readFileSync(
  resolve(__dirname, '../features/workspace/syncPendingLocalWorkspace.ts'),
  'utf8',
);
const syncSource = readFileSync(
  resolve(__dirname, '../features/memo/syncPendingMemoRows.ts'),
  'utf8',
);

describe('pending memo row sync boundary', () => {
  it('keeps the workspace sync callback as orchestration and delegates memo rows', () => {
    expect(appSource).toContain(
      "import { syncPendingLocalWorkspace as syncPendingLocalWorkspaceOutbox } from './features/workspace/syncPendingLocalWorkspace';",
    );
    expect(workspaceSource).toContain('await syncPendingMemoRows({');
    expect(appSource).not.toContain('for (const memo of await loadLocalMemos(ownerId))');
  });

  it('archives pending deletes before marking the local row synced', () => {
    const deleteCheck = syncSource.indexOf(
      "if (memo.local_sync_status === 'pending_delete')",
    );
    const archive = syncSource.indexOf(
      'await archiveMemoOnCloud(currentSession, memo.id);',
    );
    const synced = syncSource.indexOf(
      "await markLocalMemoDeleted(memo.id, 'synced', ownerId);",
    );

    expect(deleteCheck).toBeGreaterThanOrEqual(0);
    expect(deleteCheck).toBeLessThan(archive);
    expect(archive).toBeLessThan(synced);
    expect(syncSource).toContain('await cancelMemoCloudSync(memo.id);');
  });

  it('defers rows with an active editor debounce instead of pushing stale snapshots', () => {
    expect(syncSource).toContain('shouldDeferMemoSync(');
    expect(syncSource).toContain('pendingMemoIdsForOwner(');
    expect(syncSource).toContain('memoSyncTimersRef.current');
    expect(syncSource).toContain('if (memo.local_sync_status && memo.local_sync_status !== \'synced\')');
  });

  it('uses the existing memo Cloud input adapter for pending and failed rows', () => {
    expect(syncSource).toContain('getMemoCategory(memo.category)');
    expect(syncSource).toContain('await syncMemoToCloudNow(currentSession, {');
    expect(syncSource).toContain('contentUpdatedAt: memo.content_updated_at ?? memo.updated_at,');
    expect(syncSource).toContain('baseHash: memo.synced_content_hash ?? null,');
  });

  it('keeps one failed row retryable without starving the remaining workspace sync', () => {
    expect(syncSource).toContain(
      "console.warn('Pending memo sync failed; keeping it for retry.', error);",
    );
    expect(syncSource).toContain('for (const memo of await loadLocalMemos(ownerId))');
    expect(syncSource).toContain('Its pending/failed local record remains retryable.');
  });
});
