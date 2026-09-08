import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { PreviewPanelState } from '../preview/PreviewPanel';

type ActiveSidePanel = 'preview' | 'schedule-inbox' | null;

interface UseScheduleInboxPanelNavigationOptions {
  setActiveSidePanel: Dispatch<SetStateAction<ActiveSidePanel>>;
  setPreviewPanel: Dispatch<SetStateAction<PreviewPanelState | null>>;
  setSidePanelCollapsed: Dispatch<SetStateAction<boolean>>;
}

export const useScheduleInboxPanelNavigation = ({
  setActiveSidePanel,
  setPreviewPanel,
  setSidePanelCollapsed,
}: UseScheduleInboxPanelNavigationOptions) => {
  const toggleScheduleInboxPanel = useCallback(() => {
    setSidePanelCollapsed(false);
    setPreviewPanel(null);
    setActiveSidePanel(current =>
      current === 'schedule-inbox' ? null : 'schedule-inbox',
    );
  }, [setActiveSidePanel, setPreviewPanel, setSidePanelCollapsed]);

  const openScheduleInboxPanel = useCallback(() => {
    setSidePanelCollapsed(false);
    setPreviewPanel(null);
    setActiveSidePanel('schedule-inbox');
  }, [setActiveSidePanel, setPreviewPanel, setSidePanelCollapsed]);

  return { openScheduleInboxPanel, toggleScheduleInboxPanel };
};
