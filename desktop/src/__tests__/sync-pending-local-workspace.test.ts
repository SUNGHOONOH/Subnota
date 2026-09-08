import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    __dirname,
    '..',
    'features/workspace/syncPendingLocalWorkspace.ts',
  ),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('sync pending local workspace boundary', () => {
  it('keeps every local-first outbox in the shared reconnect coordinator', () => {
    expect(source).toContain('syncPendingMemoRows({');
    expect(source).toContain('syncPendingCalendarBlocks(');
    expect(source).toContain('syncPendingMemoFolders(currentSession, ownerId)');
    expect(source).toContain('syncPendingInboxItems({');
  });

  it('preserves append-only growth completion ordering and retry behavior', () => {
    expect(source).toContain('flushPendingLocalGrowthWrites()');
    expect(source).toContain('recordActivityCompletion(currentSession, completion)');
    expect(source).toContain('recordDailyCompletion(currentSession, completion)');
    expect(source).toContain("completion.local_sync_status === 'synced'");
    expect(source).toContain('// Keep the append-only completion pending for the next reconnect.');
  });

  it('keeps schedule inbox actions local-first until the server accepts them', () => {
    expect(source).toContain('loadLocalScheduleInboxActions(ownerId)');
    expect(source).toContain('updateScheduleInboxStatus(');
    expect(source).toContain('removeLocalScheduleInboxAction(action.id, ownerId)');
    expect(source).toContain('// Keep the action queued for the next reconnect or app start.');
  });

  it('retains the App callback as the single caller-facing integration point', () => {
    expect(appSource).toContain('const syncPendingLocalWorkspace = useCallback');
    expect(appSource).toContain('syncPendingLocalWorkspaceOutbox({');
    expect(appSource).toContain('syncPendingLocalWorkspace,');
  });

  it('does not render UI or own React state', () => {
    expect(source).not.toContain('useState(');
    expect(source).not.toContain('return <');
  });
});
