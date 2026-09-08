import type { PreviewPanelState } from '../preview/PreviewPanel';
import {
  canPushSidePanel,
  effectiveSidePanelWidth,
} from '../../lib/previewPanelWidth';

type AppSidePanelKind = 'preview' | 'schedule-inbox';

interface AppShellPresentationOptions {
  activeSidePanel: AppSidePanelKind | null;
  isFloatingNavDismissed: boolean;
  isSessionCollapsed: boolean;
  isSessionRailResizing: boolean;
  isSidebarCollapseReady: boolean;
  isSidePanelCollapsed: boolean;
  isSidePanelResizing: boolean;
  isWindowResizing: boolean;
  previewPanel: PreviewPanelState | null;
  previewPanelWidth: number;
  windowWidth: number;
}

export interface AppShellPresentation {
  appShellClassName: string;
  hasOpenSidePanel: boolean;
  isSidePanelPushed: boolean;
  sidePanelWidth: number;
}

export const getAppShellPresentation = ({
  activeSidePanel,
  isFloatingNavDismissed,
  isSessionCollapsed,
  isSessionRailResizing,
  isSidebarCollapseReady,
  isSidePanelCollapsed,
  isSidePanelResizing,
  isWindowResizing,
  previewPanel,
  previewPanelWidth,
  windowWidth,
}: AppShellPresentationOptions): AppShellPresentation => {
  const hasOpenSidePanel =
    activeSidePanel === 'schedule-inbox' ||
    (activeSidePanel === 'preview' && previewPanel !== null);
  const isSidePanelPushed =
    hasOpenSidePanel &&
    !isSidePanelCollapsed &&
    canPushSidePanel(windowWidth, previewPanelWidth);
  const appShellClassName = [
    'app-shell',
    isSidePanelPushed ? 'side-panel-push' : '',
    isSidePanelResizing || isWindowResizing ? 'side-panel-resizing' : '',
    isSessionRailResizing ? 'session-rail-resizing' : '',
    isSessionCollapsed ? 'session-collapsed' : '',
    isSessionCollapsed && isSidebarCollapseReady
      ? 'sidebar-collapse-ready'
      : '',
    isFloatingNavDismissed ? 'floating-nav-dismissed' : '',
    hasOpenSidePanel ? 'side-panel-open' : '',
    hasOpenSidePanel && isSidePanelCollapsed ? 'side-panel-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    appShellClassName,
    hasOpenSidePanel,
    isSidePanelPushed,
    sidePanelWidth: effectiveSidePanelWidth(windowWidth, previewPanelWidth),
  };
};
