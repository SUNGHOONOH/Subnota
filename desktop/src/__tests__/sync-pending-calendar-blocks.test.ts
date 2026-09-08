import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const workspaceSource = read('features/workspace/syncPendingLocalWorkspace.ts');
const syncSource = read('features/calendar/syncPendingCalendarBlocks.ts');

describe('pending calendar block sync boundary', () => {
  it('keeps App with one calendar sync call and no copied mutation body', () => {
    expect(appSource).toContain(
      "import { syncPendingLocalWorkspace as syncPendingLocalWorkspaceOutbox } from './features/workspace/syncPendingLocalWorkspace';",
    );
    expect(workspaceSource).toContain(
      'await syncPendingCalendarBlocks(\n    currentSession,\n    ownerId,\n    calendarMutationQueueRef,\n  );',
    );
    expect(appSource).not.toContain(
      "'Pending calendar sync failed; keeping it for retry.'",
    );
  });

  it('registers each pending block through the existing keyed queue', () => {
    expect(syncSource).toContain('loadLocalCalendarBlocks(ownerId)');
    expect(syncSource).toContain('pendingCalendarBlocks.map((block) =>');
    expect(syncSource).toContain(
      'calendarMutationQueueRef.current.enqueue(',
    );
    expect(syncSource).toContain('if (!isLatest()) return;');
  });

  it('preserves pending-delete cleanup', () => {
    expect(syncSource).toContain("block.local_sync_status === 'pending_delete'");
    expect(syncSource).toContain('await deleteCalendarBlock(currentSession, block.id);');
    expect(syncSource).toContain('await removeLocalCalendarBlock(block.id, ownerId);');
  });

  it('preserves the calendar upsert projection and local synced acknowledgement', () => {
    expect(syncSource).toContain('await upsertCalendarBlock(currentSession, {');
    expect(syncSource).toContain('allDay: Boolean(block.all_day)');
    expect(syncSource).toContain('color: block.color ?? DEFAULT_CALENDAR_COLOR');
    expect(syncSource).toContain("await upsertLocalCalendarBlock(savedBlock, 'synced', ownerId);");
  });

  it('keeps one-row failures isolated and retryable', () => {
    expect(syncSource).toContain(
      "'Pending calendar sync failed; keeping it for retry.'",
    );
    expect(syncSource).toContain('await Promise.all(');
  });
});
