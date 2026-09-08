import { useCallback, useEffect, type MutableRefObject } from 'react';

import {
  flushPendingLocalGrowthWrites,
  flushPendingLocalMemoWrites,
} from '../../services/local/offlineStore';

const LOCAL_WRITE_FLUSH_TIMEOUT_MS = 14_000;

interface UseLocalWriteGuardOptions {
  activeLocalWriteGuardRef: MutableRefObject<(() => void) | null>;
  confirmedRestoreMaintenanceRef: MutableRefObject<boolean>;
  isPreparingToQuitRef: MutableRefObject<boolean>;
  localWriteGuardAcquirePromiseRef: MutableRefObject<Promise<() => void> | null>;
  localWriteGuardUnlockRef: MutableRefObject<() => void>;
  pendingCalendarLocalWritesRef: MutableRefObject<Set<Promise<unknown>>>;
  pendingInboxTombstoneWritesRef: MutableRefObject<Map<string, Promise<void>>>;
}

/**
 * Coordinates renderer-side local writes with Electron close/backup events.
 * The guard stays active until main confirms the lifecycle or cancellation.
 */
export const useLocalWriteGuard = ({
  activeLocalWriteGuardRef,
  confirmedRestoreMaintenanceRef,
  isPreparingToQuitRef,
  localWriteGuardAcquirePromiseRef,
  localWriteGuardUnlockRef,
  pendingCalendarLocalWritesRef,
  pendingInboxTombstoneWritesRef,
}: UseLocalWriteGuardOptions) => {
  const acquireLocalWriteGuard = useCallback(() => {
    if (activeLocalWriteGuardRef.current) {
      return Promise.resolve(activeLocalWriteGuardRef.current);
    }
    if (localWriteGuardAcquirePromiseRef.current) {
      return localWriteGuardAcquirePromiseRef.current;
    }

    const acquire = (async () => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      const shellWasInert = shell?.inert ?? false;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (shell) shell.inert = true;
      // Let blur/composition-end work caused by `inert` enter the queue before
      // closing the write gate.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      isPreparingToQuitRef.current = true;
      const unlock = () => {
        if (activeLocalWriteGuardRef.current !== unlock) return;
        activeLocalWriteGuardRef.current = null;
        isPreparingToQuitRef.current = false;
        if (shell && !shellWasInert) shell.inert = false;
      };
      activeLocalWriteGuardRef.current = unlock;
      localWriteGuardUnlockRef.current = unlock;
      return unlock;
    })();
    localWriteGuardAcquirePromiseRef.current = acquire;
    const clearAcquire = () => {
      if (localWriteGuardAcquirePromiseRef.current === acquire) {
        localWriteGuardAcquirePromiseRef.current = null;
      }
    };
    void acquire.then(clearAcquire, clearAcquire);
    return acquire;
  }, [
    activeLocalWriteGuardRef,
    isPreparingToQuitRef,
    localWriteGuardAcquirePromiseRef,
    localWriteGuardUnlockRef,
  ]);

  const flushRendererLocalWrites = useCallback(async () => {
    let hasPendingWrites = true;
    while (hasPendingWrites) {
      const pendingLocalWrites = [
        ...pendingCalendarLocalWritesRef.current,
        ...pendingInboxTombstoneWritesRef.current.values(),
      ];
      await Promise.all([
        flushPendingLocalGrowthWrites(),
        flushPendingLocalMemoWrites(),
        ...pendingLocalWrites,
      ]);
      hasPendingWrites =
        pendingCalendarLocalWritesRef.current.size > 0 ||
        pendingInboxTombstoneWritesRef.current.size > 0;
    }
  }, [pendingCalendarLocalWritesRef, pendingInboxTombstoneWritesRef]);

  useEffect(() => {
    return window.electronAPI?.onFlushPendingLocalWrites?.(async (reason) => {
      const unlock = await acquireLocalWriteGuard();
      let timer = 0;
      try {
        // A confirmed restore intentionally replaces this renderer's current
        // workspace. It already attempted a normal drain before invoking main;
        // retained terminal failures must survive a failed restore, but must
        // not make a valid replacement impossible. Shutdown/window-close never
        // take this bypass.
        if (
          reason !== 'database-maintenance' ||
          !confirmedRestoreMaintenanceRef.current
        ) {
          await Promise.race([
            flushRendererLocalWrites(),
            new Promise<never>((_resolve, reject) => {
              timer = window.setTimeout(
                () => reject(new Error('Timed out flushing local writes.')),
                LOCAL_WRITE_FLUSH_TIMEOUT_MS,
              );
            }),
          ]);
        }
        // Keep the renderer read-only until main finishes the lifecycle. It
        // either closes/reloads the window or sends cancellation to release a
        // non-destructive backup/aborted operation.
      } catch (caught) {
        unlock();
        throw caught;
      } finally {
        window.clearTimeout(timer);
      }
    });
  }, [
    acquireLocalWriteGuard,
    confirmedRestoreMaintenanceRef,
    flushRendererLocalWrites,
  ]);

  useEffect(() => {
    return window.electronAPI?.onLocalWriteFlushCancelled?.(() => {
      localWriteGuardUnlockRef.current();
    });
  }, [localWriteGuardUnlockRef]);

  return { acquireLocalWriteGuard, flushRendererLocalWrites };
};
