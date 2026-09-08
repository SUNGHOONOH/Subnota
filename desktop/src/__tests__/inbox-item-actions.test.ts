import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const actionSource = readFileSync(
  resolve(__dirname, '../features/inbox/useInboxItemActions.ts'),
  'utf8',
);

describe('Inbox item actions boundary', () => {
  it('keeps App as a wiring boundary instead of owning save/delete workflows', () => {
    expect(appSource).toContain(
      "import { useInboxItemActions } from './features/inbox/useInboxItemActions';",
    );
    expect(appSource).toContain(
      'const { deleteInboxItem, saveInboxUrl } = useInboxItemActions({',
    );
    expect(appSource).not.toContain('const saveInboxUrl = async (');
    expect(appSource).not.toContain('const deleteInboxItem = (id: string) =>');
  });

  it('preserves manual validation and clip-specific alert behavior', () => {
    expect(actionSource).toContain(
      "{ source = 'clip' }: { source?: 'clip' | 'manual' } = {},",
    );
    expect(actionSource).toContain(
      "if (source === 'manual') window.alert(message);",
    );
    expect(actionSource).toContain(
      "const normalizedUrl = normalizeWebUrl(url);",
    );
    expect(actionSource).toContain('http 또는 https 웹페이지 주소만 저장할 수 있습니다.');
  });

  it('keeps local-first save, cache promotion, and delayed refresh together', () => {
    const localCreate = actionSource.indexOf('createLocalInboxSession(');
    const optimisticInsert = actionSource.indexOf(
      'setInboxItems((previous) => [localItem, ...previous])',
    );
    const remoteCreate = actionSource.indexOf('createInboxSession(');
    const cacheWrite = actionSource.indexOf(
      'await cacheLocalInboxItem(item, ownerId)',
    );
    const queueRemoval = actionSource.indexOf(
      'removeLocalInboxSessionIfNotDeleted(',
    );
    const delayedRefresh = actionSource.indexOf('void refreshInbox();');

    expect(localCreate).toBeGreaterThanOrEqual(0);
    expect(localCreate).toBeLessThan(optimisticInsert);
    expect(optimisticInsert).toBeLessThan(remoteCreate);
    expect(remoteCreate).toBeLessThan(cacheWrite);
    expect(cacheWrite).toBeLessThan(queueRemoval);
    expect(delayedRefresh).toBeGreaterThan(queueRemoval);
    expect(actionSource).toContain('}, 2500);');
  });

  it('durably tombstones deletes before selecting server or pending-client paths', () => {
    const tombstone = actionSource.indexOf(
      'const tombstoneWrite = markLocalInboxSessionDeleted(',
    );
    const awaitTombstone = actionSource.indexOf('await tombstoneWrite;');
    const pendingBranch = actionSource.indexOf('if (pendingClientId) {');
    const serverDelete = actionSource.indexOf(
      'await deleteInboxSession(currentSession, id)',
    );

    expect(tombstone).toBeGreaterThanOrEqual(0);
    expect(tombstone).toBeLessThan(awaitTombstone);
    expect(awaitTombstone).toBeLessThan(pendingBranch);
    expect(pendingBranch).toBeLessThan(serverDelete);
    expect(actionSource).toContain('deleteInboxSessionByClientId(');
    expect(actionSource).toContain('await removeLocalInboxSession(id, ownerId);');
  });

  it('guards stale sessions and cleans tombstone state on both failure paths', () => {
    expect(actionSource).toContain('if (!isCurrentSession(currentSession))');
    expect(actionSource).toContain(
      "if (currentSessionRef.current?.user.id === ownerId)",
    );
    expect(actionSource).toContain(
      'pendingInboxTombstoneWritesRef.current.delete(tombstoneKey);',
    );
    expect(actionSource).toContain(
      'Could not sync the saved-link deletion to the server.',
    );
  });
});
