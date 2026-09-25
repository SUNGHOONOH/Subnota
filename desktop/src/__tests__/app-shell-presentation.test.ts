import { describe, expect, it } from 'vitest';

import { getAppShellPresentation } from '../features/workspace/appShellPresentation';

const baseOptions = {
  activeSidePanel: null,
  isFloatingNavDismissed: false,
  isSessionCollapsed: false,
  isSessionRailResizing: false,
  isSidebarCollapseReady: false,
  isSidePanelCollapsed: false,
  isSidePanelResizing: false,
  isWindowResizing: false,
  previewPanel: null,
  previewPanelWidth: 360,
  windowWidth: 1280,
};

describe('getAppShellPresentation', () => {
  it('keeps the base shell class and width when no side panel is open', () => {
    expect(getAppShellPresentation(baseOptions)).toEqual({
      appShellClassName: 'app-shell',
      hasOpenSidePanel: false,
      isSidePanelPushed: false,
      sidePanelWidth: 360,
    });
  });

  it('opens the schedule inbox even without preview data and pushes at a wide width', () => {
    const presentation = getAppShellPresentation({
      ...baseOptions,
      activeSidePanel: 'schedule-inbox',
    });

    expect(presentation.hasOpenSidePanel).toBe(true);
    expect(presentation.isSidePanelPushed).toBe(true);
    expect(presentation.appShellClassName).toBe(
      'app-shell side-panel-push side-panel-open',
    );
  });

  it('requires preview data before treating a preview panel as open', () => {
    expect(
      getAppShellPresentation({ ...baseOptions, activeSidePanel: 'preview' })
        .hasOpenSidePanel,
    ).toBe(false);
    expect(
      getAppShellPresentation({
        ...baseOptions,
        activeSidePanel: 'preview',
        previewPanel: { mode: 'list', result: null, results: [] },
      }).hasOpenSidePanel,
    ).toBe(true);
  });

  it('keeps overlay mode at narrow widths and preserves class ordering', () => {
    const presentation = getAppShellPresentation({
      ...baseOptions,
      activeSidePanel: 'schedule-inbox',
      isFloatingNavDismissed: true,
      isSessionCollapsed: true,
      isSessionRailResizing: true,
      isSidebarCollapseReady: true,
      isSidePanelCollapsed: true,
      isSidePanelResizing: true,
      isWindowResizing: true,
      windowWidth: 800,
    });

    expect(presentation.isSidePanelPushed).toBe(false);
    expect(presentation.appShellClassName).toBe(
      'app-shell side-panel-resizing session-rail-resizing session-collapsed sidebar-collapse-ready floating-nav-dismissed side-panel-open side-panel-collapsed',
    );
  });
});
