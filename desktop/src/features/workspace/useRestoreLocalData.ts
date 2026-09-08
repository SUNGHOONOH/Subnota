import type { MutableRefObject } from 'react';

interface UseRestoreLocalDataOptions {
  acquireLocalWriteGuard: () => Promise<() => void>;
  confirmedRestoreMaintenanceRef: MutableRefObject<boolean>;
  flushRendererLocalWrites: () => Promise<void>;
}

export const useRestoreLocalData = ({
  acquireLocalWriteGuard,
  confirmedRestoreMaintenanceRef,
  flushRendererLocalWrites,
}: UseRestoreLocalDataOptions) => {
  const restoreLocalDataFromFile = async (file: File) => {
    const unlock = await acquireLocalWriteGuard();
    try {
      try {
        await flushRendererLocalWrites();
      } catch {
        // The user explicitly confirmed replacement, so a settled failed
        // write need not block restore. Keep it retained until the swap
        // succeeds, though: if restore rolls back, the next quit must retry
        // or block instead of silently forgetting that content.
      }
      confirmedRestoreMaintenanceRef.current = true;
      try {
        await window.electronAPI.restoreLocalData(
          window.electronAPI.getFilePath(file),
        );
      } finally {
        confirmedRestoreMaintenanceRef.current = false;
      }
      // Main reloads every app window after the atomic swap. A renderer that
      // fails to reload must stay guarded: letting its stale pre-restore
      // state write into the restored database would mix both workspaces.
    } catch (caught) {
      unlock();
      throw caught;
    }
  };

  return { restoreLocalDataFromFile };
};
