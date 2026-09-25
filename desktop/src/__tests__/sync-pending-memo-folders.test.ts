import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const workspaceSource = read('features/workspace/syncPendingLocalWorkspace.ts');
const syncSource = read('features/memo/syncPendingMemoFolders.ts');

describe('pending memo folder sync boundary', () => {
  it('leaves the session sync callback with one folder-domain call', () => {
    expect(appSource).toContain(
      "import { syncPendingLocalWorkspace as syncPendingLocalWorkspaceOutbox } from './features/workspace/syncPendingLocalWorkspace';",
    );
    expect(workspaceSource).toContain(
      'await syncPendingMemoFolders(currentSession, ownerId);',
    );
    expect(appSource).not.toContain(
      "'Pending folder sync failed; keeping it for retry.'",
    );
  });

  it('retries pending folders and marks each successful local row synced', () => {
    expect(syncSource).toContain('loadLocalMemoFolders(ownerId)');
    expect(syncSource).toContain('upsertMemoFolder(currentSession, folder)');
    expect(syncSource).toContain(
      "saveLocalMemoFolder(\n        { ...folder, local_sync_status: 'synced' },",
    );
    expect(syncSource).toContain(
      "'Pending folder sync failed; keeping it for retry.'",
    );
  });

  it('preserves source-aware membership synchronization', () => {
    expect(syncSource).toContain('loadLocalMemoFolderMemberships(ownerId)');
    expect(syncSource).toContain(
      "ignoreExisting: membership.source !== 'user'",
    );
    expect(syncSource).toContain(
      "saveLocalMemoFolderMembership(\n        { ...membership, local_sync_status: 'synced' },",
    );
  });

  it('keeps automatic-folder exclusions retryable', () => {
    expect(syncSource).toContain('loadLocalMemoFolderExclusions(ownerId)');
    expect(syncSource).toContain('upsertMemoFolderExclusion(currentSession, exclusion)');
    expect(syncSource).toContain(
      "'Pending folder exclusion sync failed; keeping it for retry.'",
    );
  });

  it('processes folder, membership, and exclusion delete actions independently', () => {
    expect(syncSource).toContain("action.kind === 'delete_folder'");
    expect(syncSource).toContain("action.kind === 'delete_membership'");
    expect(syncSource).toContain("action.kind === 'delete_exclusion'");
    expect(syncSource).toContain('await removeLocalMemoFolderAction(action.id, ownerId);');
    expect(syncSource).toContain(
      "'Pending folder delete failed; keeping it for retry.'",
    );
  });
});
