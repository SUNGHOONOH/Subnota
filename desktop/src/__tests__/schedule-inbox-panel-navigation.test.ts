import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/workspace/useScheduleInboxPanelNavigation.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('schedule inbox panel navigation', () => {
  it('opens the panel by clearing collapse and preview state first', () => {
    expect(source).toContain('setSidePanelCollapsed(false);');
    expect(source).toContain('setPreviewPanel(null);');
    expect(source).toContain("setActiveSidePanel('schedule-inbox');");
  });

  it('toggles the schedule inbox panel between open and closed', () => {
    expect(source).toContain(
      "current === 'schedule-inbox' ? null : 'schedule-inbox'",
    );
  });

  it('keeps both actions as stable callbacks with the shared setters', () => {
    expect(source).toContain('useCallback(');
    expect(source).toContain(
      '[setActiveSidePanel, setPreviewPanel, setSidePanelCollapsed]',
    );
    expect(source).toContain(
      'return { openScheduleInboxPanel, toggleScheduleInboxPanel };',
    );
  });

  it('keeps App callers wired to the extracted actions', () => {
    expect(appSource).toContain(
      'const {\n    openScheduleInboxPanel,\n    toggleScheduleInboxPanel,\n  } = useScheduleInboxPanelNavigation({',
    );
    expect(appSource).not.toContain(
      'const toggleScheduleInboxPanel = useCallback(() => {',
    );
    expect(appSource).not.toContain(
      'const openScheduleInboxPanel = useCallback(() => {',
    );
    expect(appSource).toContain('onOpenScheduleInboxPanel: openScheduleInboxPanel');
    expect(appSource).toContain('onToggleScheduleInboxPanel={toggleScheduleInboxPanel}');
  });
});
