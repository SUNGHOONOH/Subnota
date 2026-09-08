import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useLocalWriteGuard.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('local write guard boundary', () => {
  it('keeps App with guard refs and hook wiring only', () => {
    expect(appSource).toContain(
      "import { useLocalWriteGuard } from './features/workspace/useLocalWriteGuard';",
    );
    expect(appSource).toContain('useLocalWriteGuard({');
    expect(appSource).not.toContain('const shell = document.querySelector<HTMLElement>(\'.app-shell\');');
  });

  it('deduplicates concurrent guard acquisition and preserves inert restoration', () => {
    expect(source).toContain('if (activeLocalWriteGuardRef.current)');
    expect(source).toContain('if (localWriteGuardAcquirePromiseRef.current)');
    expect(source).toContain('const shellWasInert = shell?.inert ?? false;');
    expect(source).toContain('if (shell && !shellWasInert) shell.inert = false;');
    expect(source).toContain('isPreparingToQuitRef.current = true;');
  });

  it('flushes every pending local write until calendar and Inbox queues drain', () => {
    expect(source).toContain('flushPendingLocalGrowthWrites()');
    expect(source).toContain('flushPendingLocalMemoWrites()');
    expect(source).toContain('pendingInboxTombstoneWritesRef.current.values()');
    expect(source).toContain('while (hasPendingWrites)');
    expect(source).toContain('pendingCalendarLocalWritesRef.current.size > 0');
  });

  it('keeps the explicit restore-maintenance bypass and 14-second timeout', () => {
    expect(source).toContain("reason !== 'database-maintenance'");
    expect(source).toContain('!confirmedRestoreMaintenanceRef.current');
    expect(source).toContain('LOCAL_WRITE_FLUSH_TIMEOUT_MS = 14_000');
    expect(source).toContain("new Error('Timed out flushing local writes.')");
  });

  it('unlocks on failure and on Electron cancellation', () => {
    expect(source).toContain('unlock();\n        throw caught;');
    expect(source).toContain('onLocalWriteFlushCancelled');
    expect(source).toContain('localWriteGuardUnlockRef.current();');
  });
});
