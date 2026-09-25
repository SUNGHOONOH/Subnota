import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const actionSource = readFileSync(
  resolve(__dirname, '../features/auth/useAccountActions.ts'),
  'utf8',
);

describe('account action boundary', () => {
  it('keeps App with account callback wiring and removes the lifecycle bodies', () => {
    expect(appSource).toContain(
      "import { useAccountActions } from './features/auth/useAccountActions';",
    );
    expect(appSource).toContain(
      'const { handleDeleteAccount, handleSignOut } = useAccountActions({',
    );
    expect(appSource).not.toContain('const handleSignOut = async () =>');
    expect(appSource).not.toContain('const handleDeleteAccount = async () =>');
  });

  it('falls back to local sign-out and clears the in-memory session when global sign-out fails', () => {
    expect(actionSource).toContain('await signOut();');
    expect(actionSource).toContain(
      "await supabase.auth.signOut({ scope: 'local' });",
    );
    expect(actionSource).toContain('deactivateSession();');
  });

  it('requires an owner before deleting an account and cancels local indexers first', () => {
    expect(actionSource).toContain(
      'const ownerId = sessionRef.current?.user.id ?? session?.user.id;',
    );
    expect(actionSource).toContain('if (!ownerId) {');
    expect(actionSource.indexOf('cancelLocalMemoIndexing();')).toBeLessThan(
      actionSource.indexOf('await deleteAccount();'),
    );
    expect(actionSource.indexOf('cancelLocalInboxIndexing();')).toBeLessThan(
      actionSource.indexOf('await deleteAccount();'),
    );
  });

  it('reports partial local cleanup while preserving the successful account deletion notice', () => {
    expect(actionSource).toContain('let localCleanupFailed = false;');
    expect(actionSource).toContain('await clearLocalWorkspaceOwner(ownerId);');
    expect(actionSource).toContain(
      '계정은 삭제되었지만 이 기기의 일부 데이터 정리에 문제가 있습니다.',
    );
    expect(actionSource).toContain('계정과 데이터가 삭제되었습니다.');
  });

  it('closes settings and always deactivates the session after account deletion', () => {
    expect(actionSource).toContain('setSettingsOpen(false);');
    expect(actionSource).toContain(
      "await supabase.auth.signOut({ scope: 'local' });",
    );
    expect(actionSource).toContain('} finally {\n      deactivateSession();');
  });
});
