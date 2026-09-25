import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/workspace/useSessionSidebarToggle.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('session sidebar toggle action', () => {
  it('clears an active collapse timer before changing sidebar state', () => {
    expect(source).toContain(
      'if (sidebarCollapseTimerRef.current !== null)',
    );
    expect(source).toContain('window.clearTimeout(sidebarCollapseTimerRef.current);');
    expect(source).toContain('sidebarCollapseTimerRef.current = null;');
  });

  it('resets floating-nav and collapse-ready state on every toggle', () => {
    expect(source).toContain('setFloatingNavDismissed(false);');
    expect(source).toContain('setSidebarCollapseReady(false);');
    expect(source).toContain('setSessionCollapsed(nextCollapsed);');
  });

  it('starts the readiness timer only while collapsing', () => {
    expect(source).toContain('if (nextCollapsed)');
    expect(source).toContain(
      'sidebarCollapseTimerRef.current = window.setTimeout(',
    );
    expect(source).toContain('setSidebarCollapseReady(true);');
    expect(source).toContain('sidebarCollapseTimerRef.current = null;');
    expect(source).toContain('}, collapseDurationMs);');
  });

  it('keeps App-owned timer and states wired to the extracted hook', () => {
    expect(appSource).toContain(
      'const { toggleSession } = useSessionSidebarToggle({',
    );
    expect(appSource).not.toContain('const toggleSession = useCallback(() => {');
    expect(appSource).toContain(
      'collapseDurationMs: SIDEBAR_COLLAPSE_DURATION_MS',
    );
    expect(appSource).toContain('sidebarCollapseTimerRef,');
    expect(appSource).toContain('toggleSidebar: toggleSession');
  });
});
