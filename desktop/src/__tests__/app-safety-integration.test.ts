import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');
const mainSource = readFileSync(resolve(__dirname, '..', 'main.ts'), 'utf8');
const miniSource = readFileSync(
  resolve(__dirname, '..', 'features/mini/MiniComposer.tsx'),
  'utf8',
);

const section = (start: string, end: string) =>
  appSource.slice(appSource.indexOf(start), appSource.indexOf(end));

describe('App safety integrations', () => {
  it('protects the active Tiptap document in both SQLite replacement and React merge', () => {
    const remoteLoad = section(
      'const loadWorkspace = useCallback',
      'const restoreWorkspaceForAccount',
    );

    expect(remoteLoad).toContain('activeMemoIdsInPanes(splitPanesRef.current)');
    expect(remoteLoad).toContain(
      'replaceSyncedMemos(visibleRemoteMemos, ownerId, protectedMemoIds)',
    );
    expect(remoteLoad).toContain('restoreLocalMemoSnapshotAfterPull(memo, ownerId)');
    expect(remoteLoad).toMatch(
      /mergeLoadedMemosPreservingLocalWrites\([\s\S]*?latestPendingLocalWriteIds,[\s\S]*?latestActiveEditorMemoIds/,
    );
  });

  it('rebases an in-flight memo edit and applies content with its acknowledged base atomically', () => {
    const memoSync = section(
      'const enqueueMemoCloudSync',
      'const scheduleMemoCloudSync',
    );

    expect(memoSync).toContain('rebaseEditorChangeOntoCanonical(');
    expect(memoSync).toContain('await applyLocalMemoSyncResult(');
    expect(memoSync).toContain('memosRef.current = installCanonicalIfCurrent');
    expect(memoSync).not.toContain('updateLocalMemoSyncedBase(');
  });

  it('serializes every remote calendar mutation and ignores stale completions', () => {
    const pendingSync = section(
      'const syncPendingLocalWorkspace',
      'const loadWorkspace',
    );
    const calendarMutations = section(
      'const saveCalendarBlock',
      'const placeScheduleInboxItem',
    );

    expect(calendarMutations.match(/calendarMutationQueueRef\.current\.enqueue/g)).toHaveLength(3);
    expect(calendarMutations.match(/if \(!isLatest\(\)\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(pendingSync).toMatch(
      /pendingCalendarBlocks\.map\(\(block\) =>\s*calendarMutationQueueRef\.current\.enqueue\(/,
    );
    expect(pendingSync).toContain("block.local_sync_status !== 'synced'");
    expect(calendarMutations.indexOf('await localPersistPromise;')).toBeLessThan(
      calendarMutations.indexOf(
        'recordGrowthOnComplete(updated, nextBlocks)',
      ),
    );
    expect(calendarMutations).toContain(
      'trackCalendarLocalWrite(\n        localPersistPromise.then(() =>',
    );
    expect(pendingSync).toContain('recordActivityCompletion(currentSession, completion)');
    expect(pendingSync).toContain('recordDailyCompletion(currentSession, completion)');
    expect(pendingSync).toContain(
      'Pending memo sync failed; keeping it for retry.',
    );
    expect(pendingSync).toContain(
      'Pending calendar sync failed; keeping it for retry.',
    );
  });

  it('uses the OS login-item state instead of restoring a stale app preference', () => {
    const preferences = mainSource.slice(
      mainSource.indexOf('const readDesktopPreferences'),
      mainSource.indexOf("ipcMain.handle('clipboard:write-text'"),
    );
    const startup = mainSource.slice(
      mainSource.indexOf("app.on('ready'"),
      mainSource.indexOf("app.on('window-all-closed'"),
    );

    expect(preferences).toContain(
      "typeof app.getLoginItemSettings === 'function'",
    );
    expect(preferences).not.toContain('.openAtLogin ||');
    expect(startup).toContain(
      "if (typeof app.getLoginItemSettings !== 'function')",
    );
  });

  it('closes a dedicated workspace gate only across an account owner change', () => {
    const activation = section('const activateSession', 'const deactivateSession');

    expect(activation).toContain('setWorkspaceOwnerTransition(true)');
    expect(activation).toContain('setInboxLoading(false)');
    expect(activation).toContain('setWorkspaceOwnerTransition(false)');
    expect(appSource).toContain(
      'if (session && isWorkspaceOwnerTransition) {\n    return <WorkspaceBootSkeleton />;\n  }',
    );
    expect(activation).toContain('setActiveWorkspaceOwner?.(ownerId)');
    expect(miniSource).toContain('activeOwnerId !== ownerId');
    expect(miniSource).toContain('계정을 확인할 수 없어 저장하지 않았습니다.');
  });

  it('surfaces terminal local memo write failures instead of reporting saved', () => {
    const saveMemo = section('const saveMemoContent', 'const flushLocalMemoIndex');

    expect(saveMemo).toContain("[id]: 'saving-local'");
    expect(saveMemo).toContain("[id]: 'local-failed'");
    expect(saveMemo).toContain('.catch(() => {');
    expect(appSource).toContain('memoSaveStates={memoSaveStates}');
  });

  it('bypasses retained failures only for an explicitly confirmed restore maintenance', () => {
    const flush = section(
      'const flushRendererLocalWrites',
      'const discardDeletedPendingInboxItem',
    );
    const restore = section(
      'const restoreLocalDataFromFile',
      '// The Quick Subnota panel',
    );

    expect(flush).toContain("reason !== 'database-maintenance'");
    expect(flush).toContain('!confirmedRestoreMaintenanceRef.current');
    expect(restore).toContain('confirmedRestoreMaintenanceRef.current = true');
    expect(restore).toContain('confirmedRestoreMaintenanceRef.current = false');
  });
});
