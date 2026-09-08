import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/auth/useSessionLifecycle.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('session lifecycle boundary', () => {
  it('keeps App with only the auth lifecycle wiring', () => {
    expect(appSource).toContain(
      "import { useSessionLifecycle } from './features/auth/useSessionLifecycle';",
    );
    expect(appSource).toContain(
      'const { activateSession, deactivateSession } = useSessionLifecycle({',
    );
    expect(appSource).not.toContain(
      'const activationId = ++sessionActivationIdRef.current;',
    );
  });

  it('invalidates older loads and clears cross-account Inbox state before activation', () => {
    expect(source).toContain('const activationId = ++sessionActivationIdRef.current;');
    expect(source).toContain('workspaceLoadIdRef.current += 1;');
    expect(source).toContain('setWorkspaceOwnerTransition(true);');
    expect(source).toContain('deletedPendingInboxClientIdsRef.current.clear();');
    expect(source).toContain('pendingInboxDeleteIdsRef.current.clear();');
    expect(source).toContain('inboxServerIdsByClientIdRef.current.clear();');
  });

  it('fails closed if the new owner local workspace cannot be applied', () => {
    expect(source).toContain('if (sessionActivationIdRef.current !== activationId) return;');
    expect(source).toContain('memosRef.current = [];');
    expect(source).toContain('setLocalWorkspaceReady(true);');
    expect(source).toContain('Could not load the local workspace.');
  });

  it('keeps local-first activation before quiet server synchronization', () => {
    expect(source).toContain('await applyLocalWorkspace(ownerId);');
    expect(source).toContain('await waitForBootSync(loadWorkspace(nextSession, { quiet: true }));');
  });

  it('invalidates and clears retry state when a session is deactivated', () => {
    const deactivate = source.slice(source.indexOf('const deactivateSession'));
    expect(deactivate).toContain('sessionActivationIdRef.current += 1;');
    expect(deactivate).toContain('workspaceLoadIdRef.current += 1;');
    expect(deactivate).toContain('memoSyncRetryTimersRef.current.clear();');
    expect(deactivate).toContain('memoSyncRetryAttemptsRef.current.clear();');
    expect(deactivate).toContain('restoreWorkspaceForAccount(null);');
    expect(deactivate).toContain('void applyLocalWorkspace();');
  });
});
