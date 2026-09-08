import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

interface UseSessionSidebarToggleOptions {
  collapseDurationMs: number;
  isSessionCollapsed: boolean;
  setFloatingNavDismissed: Dispatch<SetStateAction<boolean>>;
  setSessionCollapsed: Dispatch<SetStateAction<boolean>>;
  setSidebarCollapseReady: Dispatch<SetStateAction<boolean>>;
  sidebarCollapseTimerRef: MutableRefObject<number | null>;
}

export const useSessionSidebarToggle = ({
  collapseDurationMs,
  isSessionCollapsed,
  setFloatingNavDismissed,
  setSessionCollapsed,
  setSidebarCollapseReady,
  sidebarCollapseTimerRef,
}: UseSessionSidebarToggleOptions) => {
  const toggleSession = useCallback(() => {
    const nextCollapsed = !isSessionCollapsed;
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
      sidebarCollapseTimerRef.current = null;
    }

    setFloatingNavDismissed(false);
    setSidebarCollapseReady(false);
    setSessionCollapsed(nextCollapsed);

    if (nextCollapsed) {
      sidebarCollapseTimerRef.current = window.setTimeout(() => {
        setSidebarCollapseReady(true);
        sidebarCollapseTimerRef.current = null;
      }, collapseDurationMs);
    }
  }, [
    collapseDurationMs,
    isSessionCollapsed,
    setFloatingNavDismissed,
    setSessionCollapsed,
    setSidebarCollapseReady,
    sidebarCollapseTimerRef,
  ]);

  return { toggleSession };
};
