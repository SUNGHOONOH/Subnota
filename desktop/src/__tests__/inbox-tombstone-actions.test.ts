import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/inbox/useInboxTombstoneActions.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('Inbox tombstone action boundary', () => {
  it('keeps App with the tombstone hook wiring only', () => {
    expect(appSource).toContain(
      "import { useInboxTombstoneActions } from './features/inbox/useInboxTombstoneActions';",
    );
    expect(appSource).toContain('useInboxTombstoneActions({');
    expect(appSource).not.toContain(
      'const discardDeletedPendingInboxItem = useCallback(',
    );
  });

  it('waits for the pending tombstone before deleting the server row', () => {
    expect(source).toContain(
      'await pendingInboxTombstoneWritesRef.current.get(',
    );
    expect(source).toMatch(
      /await deleteInboxSessionByClientId\(\s*currentSession,\s*clientId,?\s*\)/,
    );
    expect(source.indexOf('await deleteInboxSessionByClientId')).toBeLessThan(
      source.indexOf('await removeLocalInboxSession(clientId, ownerId)'),
    );
  });

  it('clears both client-id and server-id tombstone state only after deletion', () => {
    expect(source).toContain(
      'inboxServerIdsByClientIdRef.current.delete(clientId);',
    );
    expect(source).toContain(
      'deletedPendingInboxClientIdsRef.current.delete(clientId);',
    );
    expect(source).toContain(
      'pendingInboxDeleteIdsRef.current.delete(item.id);',
    );
  });

  it('retries only items with a recorded client-id tombstone', () => {
    expect(source).toContain(
      '!deletedPendingInboxClientIdsRef.current.has(clientId)',
    );
    expect(source).toContain(
      'void discardDeletedPendingInboxItem(\n          currentSession,',
    );
  });

  it('keeps the returned callbacks stable through useCallback', () => {
    expect(source.match(/useCallback\(/g)).toHaveLength(2);
    expect(source).toContain('return { discardDeletedPendingInboxItem, retryDeletedPendingInboxItems };');
  });
});
