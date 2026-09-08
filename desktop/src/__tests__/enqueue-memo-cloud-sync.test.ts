import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const syncSource = readFileSync(
  resolve(__dirname, '../features/memo/useEnqueueMemoCloudSync.ts'),
  'utf8',
);

describe('memo Cloud enqueue boundary', () => {
  it('keeps App with enqueue callback wiring and removes the large sync body', () => {
    expect(appSource).toContain(
      "import { useEnqueueMemoCloudSync } from './features/memo/useEnqueueMemoCloudSync';",
    );
    expect(appSource).toContain(
      'const { enqueueMemoCloudSync } = useEnqueueMemoCloudSync({',
    );
    expect(appSource).not.toContain(
      'const enqueueMemoCloudSync = useCallback(',
    );
  });

  it('serializes the same memo and ignores stale session or revision work', () => {
    expect(syncSource).toContain(
      'memoSyncChainsRef.current.get(memo.id) ?? Promise.resolve()',
    );
    expect(syncSource).toContain('memoSyncChainsRef.current.set(memo.id, sync);');
    expect(syncSource).toContain('if (!isCurrentSession(currentSession))');
    expect(syncSource).toContain(
      'memoSyncRevisionsRef.current.get(memo.id) !== revision',
    );
  });

  it('resolves the concurrency base at push time and keeps delete-wins semantics', () => {
    const localRead = syncSource.indexOf('const localRow = await getLocalMemo(');
    const push = syncSource.indexOf('const result = await pushMemoMerging(');
    const deleted = syncSource.indexOf("if (result.status === 'deleted') {");

    expect(localRead).toBeGreaterThanOrEqual(0);
    expect(localRead).toBeLessThan(push);
    expect(push).toBeLessThan(deleted);
    expect(syncSource).toContain('await markLocalMemoDeleted(');
    expect(syncSource).toContain(
      'setMemos((previous) =>\n              previous.filter((item) => item.id !== memo.id),',
    );
  });

  it('rebases in-flight editor input and applies the canonical snapshot atomically', () => {
    expect(syncSource).toContain('rebaseEditorChangeOntoCanonical(');
    expect(syncSource).toContain(
      'memosRef.current = installCanonicalIfCurrent(memosRef.current);',
    );
    expect(syncSource).toContain('setMemos(installCanonicalIfCurrent);');
    expect(syncSource).toContain('await applyLocalMemoSyncResult(');
  });

  it('preserves the last sync base and schedules retry after a current-owner failure', () => {
    expect(syncSource).toContain(
      'memoSyncRevisionsRef.current.get(memo.id) === revision',
    );
    expect(syncSource).toContain('synced_content: failedRow?.synced_content ?? null,');
    expect(syncSource).toContain("'failed',\n                currentSession.user.id,");
    expect(syncSource).toContain(
      "console.warn('Memo cloud sync failed; retry scheduled.', error);",
    );
    expect(syncSource).toContain(
      'scheduleMemoCloudRetry(currentSession, memoToPush);',
    );
  });
});
