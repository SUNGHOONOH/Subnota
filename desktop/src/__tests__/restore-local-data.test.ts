import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const restoreSource = readFileSync(
  resolve(__dirname, '../features/workspace/useRestoreLocalData.ts'),
  'utf8',
);

describe('local data restore boundary', () => {
  it('keeps App with restore callback wiring and removes the destructive workflow body', () => {
    expect(appSource).toContain(
      "import { useRestoreLocalData } from './features/workspace/useRestoreLocalData';",
    );
    expect(appSource).toContain(
      'const { restoreLocalDataFromFile } = useRestoreLocalData({',
    );
    expect(appSource).not.toContain(
      'const restoreLocalDataFromFile = useCallback(',
    );
  });

  it('acquires the renderer write guard before flushing or swapping data', () => {
    const guard = restoreSource.indexOf(
      'const unlock = await acquireLocalWriteGuard();',
    );
    const flush = restoreSource.indexOf('await flushRendererLocalWrites();');
    const swap = restoreSource.indexOf('await window.electronAPI.restoreLocalData(');

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(flush);
    expect(flush).toBeLessThan(swap);
  });

  it('allows a previously failed write to remain retained during an explicit restore', () => {
    expect(restoreSource).toContain('} catch {\n        // The user explicitly confirmed replacement');
    expect(restoreSource).toContain(
      'if restore rolls back, the next quit must retry',
    );
  });

  it('marks maintenance mode only around the atomic Electron restore call', () => {
    const mark = restoreSource.indexOf(
      'confirmedRestoreMaintenanceRef.current = true;',
    );
    const restoreCall = restoreSource.indexOf(
      'await window.electronAPI.restoreLocalData(',
    );
    const clear = restoreSource.indexOf(
      'confirmedRestoreMaintenanceRef.current = false;',
    );

    expect(mark).toBeGreaterThanOrEqual(0);
    expect(mark).toBeLessThan(restoreCall);
    expect(restoreCall).toBeLessThan(clear);
  });

  it('unlocks and rethrows when the guarded restore fails', () => {
    expect(restoreSource).toContain('} catch (caught) {');
    expect(restoreSource).toContain('unlock();');
    expect(restoreSource).toContain('throw caught;');
  });
});
