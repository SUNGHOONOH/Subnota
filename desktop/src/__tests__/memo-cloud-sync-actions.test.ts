import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const actionSource = readFileSync(
  resolve(__dirname, '../features/memo/useMemoCloudSyncActions.ts'),
  'utf8',
);

describe('memo Cloud sync controls boundary', () => {
  it('keeps App with sync control wiring and removes the retry/control bodies', () => {
    expect(appSource).toContain(
      "import { useMemoCloudSyncActions } from './features/memo/useMemoCloudSyncActions';",
    );
    expect(appSource).toContain('} = useMemoCloudSyncActions({');
    expect(appSource).not.toContain('const syncMemoToCloudNow = useCallback(');
    expect(appSource).not.toContain('const cancelMemoCloudSync = useCallback(');
  });

  it('registers the latest retry callback and clears it when the boundary unmounts', () => {
    expect(actionSource).toContain('const runMemoCloudRetry = useCallback(');
    expect(actionSource).toContain(
      'memoSyncRetryRunnerRef.current = runMemoCloudRetry;',
    );
    expect(actionSource).toContain(
      'memoSyncRetryRunnerRef.current = null;',
    );
  });

  it('cancels a scheduled debounce and runs the current memo sync immediately', () => {
    const timeout = actionSource.indexOf(
      'const timeout = memoSyncTimersRef.current.get(memo.id);',
    );
    const cancel = actionSource.indexOf(
      'cancelMemoCloudRetry(memo.id);',
      timeout,
    );
    const run = actionSource.indexOf(
      'await runMemoCloudRetry(currentSession, memo);',
    );

    expect(timeout).toBeGreaterThanOrEqual(0);
    expect(timeout).toBeLessThan(cancel);
    expect(cancel).toBeLessThan(run);
  });

  it('limits manual retry to failed memos and clears the progress marker in finally', () => {
    expect(actionSource).toContain(
      "memo?.local_sync_status !== 'failed'",
    );
    expect(actionSource).toContain(
      'setManualMemoSyncRetryIds((previous) => [',
    );
    expect(actionSource).toContain(
      'setManualMemoSyncRetryIds((previous) =>\n          previous.filter((id) => id !== memoId),',
    );
    expect(actionSource).toContain(
      'memoCloudSyncInput(memo)',
    );
  });

  it('invalidates queued work before waiting for the existing chain to settle', () => {
    expect(actionSource).toContain(
      'memoSyncRevisionsRef.current.set(',
    );
    expect(actionSource).toContain(
      'await memoSyncChainsRef.current.get(memoId)?.catch(() => undefined);',
    );
    expect(actionSource).toContain(
      'memoSyncTimersRef.current.delete(memoId);',
    );
  });
});
