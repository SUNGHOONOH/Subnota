import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/memo/useMemoCloudRetryScheduler.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('memo cloud retry scheduler boundary', () => {
  it('keeps App with retry scheduler wiring only', () => {
    expect(appSource).toContain(
      "import { useMemoCloudRetryScheduler } from './features/memo/useMemoCloudRetryScheduler';",
    );
    expect(appSource).toContain('useMemoCloudRetryScheduler({');
    expect(appSource).not.toContain('const cancelMemoCloudRetry = useCallback(');
  });

  it('backs off one retry timer per memo while respecting offline state', () => {
    expect(source).toContain('if (!navigator.onLine || memoSyncRetryTimersRef.current.has(memo.id))');
    expect(source).toContain('memoSyncRetryDelay(attempt)');
    expect(source).toContain('memoSyncRetryTimersRef.current.set(memo.id, timeout);');
  });

  it('checks the current session and latest failed row before retrying', () => {
    expect(source).toContain('!isCurrentSession(currentSession)');
    expect(source).toContain('const latestMemo = memosRef.current.find');
    expect(source).toContain("latestMemo?.local_sync_status !== 'failed'");
    expect(source).toContain('memoSyncRetryRunnerRef.current?.(');
  });

  it('cancels timers and optionally resets attempt counters', () => {
    expect(source).toContain('window.clearTimeout(timeout);');
    expect(source).toContain('memoSyncRetryTimersRef.current.delete(memoId);');
    expect(source).toContain('memoSyncRetryAttemptsRef.current.delete(memoId);');
  });

  it('cleans retry timers and attempts on unmount', () => {
    expect(source.match(/useEffect\(/g)).toHaveLength(1);
    expect(source).toContain('memoSyncRetryTimersRef.current.clear();');
    expect(source).toContain('memoSyncRetryAttemptsRef.current.clear();');
  });
});
