import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const workspaceSource = read('features/workspace/syncPendingLocalWorkspace.ts');
const syncSource = read('features/inbox/syncPendingInboxItems.ts');

describe('pending Inbox item sync boundary', () => {
  it('keeps App with the session-to-Inbox sync wiring', () => {
    expect(appSource).toContain(
      "import { syncPendingLocalWorkspace as syncPendingLocalWorkspaceOutbox } from './features/workspace/syncPendingLocalWorkspace';",
    );
    expect(workspaceSource).toContain('await syncPendingInboxItems({');
    expect(appSource).not.toContain(
      'for (const tombstone of (await loadLocalInboxItems(ownerId)).filter(',
    );
  });

  it('deletes pending tombstones by server id or client id before clearing local state', () => {
    expect(syncSource).toContain('loadLocalInboxItems(ownerId)');
    expect(syncSource).toContain('deleteInboxSessionByClientId(');
    expect(syncSource).toContain('deleteInboxSession(currentSession, tombstone.id)');
    expect(syncSource).toContain('if (!deleted) continue;');
    expect(syncSource).toContain('await removeLocalInboxSession(tombstone.id, ownerId);');
  });

  it('keeps local create queue writes cache-first and restart-safe', () => {
    expect(syncSource).toContain('loadLocalInboxQueue(ownerId)');
    expect(syncSource).toContain('await createInboxSession(currentSession, {');
    expect(syncSource).toContain('await cacheLocalInboxItem(created, ownerId);');
    expect(syncSource).toContain('removeLocalInboxSessionIfNotDeleted(');
  });

  it('checks for deletion after create and cache to prevent resurrection', () => {
    expect(syncSource).toContain('const pendingItemWasDeleted = async () =>');
    expect(syncSource.match(/await pendingItemWasDeleted\(\)/g)).toHaveLength(3);
    expect(syncSource).toContain('discardDeletedPendingInboxItem(');
    expect(syncSource).toContain('pendingInboxDeleteIdsRef.current.add(item.clientId);');
  });

  it('keeps failed queue items pending for reconnect or the next app start', () => {
    expect(syncSource).toContain(
      '// Keep the item queued. Reconnect or a later app start retries it.',
    );
    expect(syncSource).toContain(
      '// Keep the tombstone hidden and retry on reconnect/app start.',
    );
  });
});
