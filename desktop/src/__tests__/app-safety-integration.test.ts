import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = `${readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8')}\n${readFileSync(
  resolve(__dirname, '..', 'features/workspace/AppEntryGate.tsx'),
  'utf8',
)}`;
const pendingCalendarSyncSource = readFileSync(
  resolve(__dirname, '..', 'features/calendar/syncPendingCalendarBlocks.ts'),
  'utf8',
);
const calendarCompletionSource = readFileSync(
  resolve(__dirname, '..', 'features/calendar/useCalendarCompletionActions.ts'),
  'utf8',
);
const calendarDeleteSource = readFileSync(
  resolve(__dirname, '..', 'features/calendar/useDeleteCalendarBlock.ts'),
  'utf8',
);
const calendarSaveSource = readFileSync(
  resolve(__dirname, '..', 'features/calendar/useSaveCalendarBlock.ts'),
  'utf8',
);
const memoContentPersistenceSource = readFileSync(
  resolve(__dirname, '..', 'features/memo/useMemoContentPersistence.ts'),
  'utf8',
);
const memoCloudEnqueueSource = readFileSync(
  resolve(__dirname, '..', 'features/memo/useEnqueueMemoCloudSync.ts'),
  'utf8',
);
const pendingMemoRowsSource = readFileSync(
  resolve(__dirname, '..', 'features/memo/syncPendingMemoRows.ts'),
  'utf8',
);
const restoreLocalDataSource = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useRestoreLocalData.ts'),
  'utf8',
);
const pendingWorkspaceSyncSource = readFileSync(
  resolve(__dirname, '..', 'features/workspace/syncPendingLocalWorkspace.ts'),
  'utf8',
);
const workspaceLoaderSource = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useWorkspaceLoader.ts'),
  'utf8',
);
const sessionLifecycleSource = readFileSync(
  resolve(__dirname, '..', 'features/auth/useSessionLifecycle.ts'),
  'utf8',
);
const localWriteGuardSource = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useLocalWriteGuard.ts'),
  'utf8',
);
const mainSource = readFileSync(resolve(__dirname, '..', 'main.ts'), 'utf8');
const miniSource = readFileSync(
  resolve(__dirname, '..', 'features/mini/MiniComposer.tsx'),
  'utf8',
);

describe('App safety integrations', () => {
  it('protects the active Tiptap document in both SQLite replacement and React merge', () => {
    const remoteLoad = workspaceLoaderSource;

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
    const memoSync = memoCloudEnqueueSource;

    expect(memoSync).toContain('rebaseEditorChangeOntoCanonical(');
    expect(memoSync).toContain('await applyLocalMemoSyncResult(');
    expect(memoSync).toContain('memosRef.current = installCanonicalIfCurrent');
    expect(memoSync).not.toContain('updateLocalMemoSyncedBase(');
  });

  it('serializes every remote calendar mutation and ignores stale completions', () => {
    const pendingSync = `${pendingWorkspaceSyncSource}\n${pendingMemoRowsSource}\n${pendingCalendarSyncSource}`;
    const calendarMutations = `${calendarSaveSource}\n${calendarCompletionSource}\n${calendarDeleteSource}`;

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
    const activation = sessionLifecycleSource;

    expect(appSource).toContain(
      "import { useSessionLifecycle } from './features/auth/useSessionLifecycle';",
    );
    expect(appSource).toContain('useSessionLifecycle({');
    expect(activation).toContain('setWorkspaceOwnerTransition(true)');
    expect(activation).toContain('setInboxLoading(false)');
    expect(activation).toContain('setWorkspaceOwnerTransition(false)');
    expect(appSource).toContain(
      'if (isSignedIn && isWorkspaceOwnerTransition) {\n    return <WorkspaceBootSkeleton />;\n  }',
    );
    expect(activation).toContain('setActiveWorkspaceOwner?.(ownerId)');
    expect(miniSource).toContain('activeOwnerId !== ownerId');
    expect(miniSource).toContain('계정을 확인할 수 없어 저장하지 않았습니다.');
  });

  it('surfaces terminal local memo write failures instead of reporting saved', () => {
    const saveMemo = memoContentPersistenceSource;

    expect(saveMemo).toContain("[id]: 'saving-local'");
    expect(saveMemo).toContain("[id]: 'local-failed'");
    expect(saveMemo).toContain('.catch(() => {');
    expect(appSource).toContain('memoSaveStates={memoSaveStates}');
  });

  it('bypasses retained failures only for an explicitly confirmed restore maintenance', () => {
    const flush = localWriteGuardSource;
    const restore = restoreLocalDataSource;

    expect(flush).toContain("reason !== 'database-maintenance'");
    expect(flush).toContain('!confirmedRestoreMaintenanceRef.current');
    expect(restore).toContain('confirmedRestoreMaintenanceRef.current = true');
    expect(restore).toContain('confirmedRestoreMaintenanceRef.current = false');
  });
});
