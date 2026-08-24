import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const workspaceSource = readFileSync(
  resolve(__dirname, '../features/memo/components/MemoSplitWorkspace.tsx'),
  'utf8',
);
const memoWorkspaceSource = readFileSync(
  resolve(__dirname, '../features/memo/MemoWorkspace.tsx'),
  'utf8',
);
const authSource = readFileSync(
  resolve(__dirname, '../features/auth/AuthScreen.tsx'),
  'utf8',
);
const rendererSource = readFileSync(resolve(__dirname, '../renderer.tsx'), 'utf8');
const styles = readFileSync(
  resolve(__dirname, '../styles/subnota-workspace.scss'),
  'utf8',
);

describe('workspace shell layout', () => {
  it('keeps a blank draggable title bar while the login screen is shown', () => {
    expect(authSource).toContain('className="desktop-auth-container two-col"');
    expect(rendererSource).toContain(
      'document.documentElement.dataset.desktopPlatform',
    );
    expect(styles).toMatch(
      /\.desktop-auth-container::before\s*\{[\s\S]*?height:\s*32px[\s\S]*?position:\s*fixed[\s\S]*?-webkit-app-region:\s*drag/,
    );
    expect(styles).toContain(
      "html:not([data-desktop-platform='macos']) .desktop-auth-container::before",
    );
    expect(styles).toContain(
      "html:not([data-desktop-platform='macos']) .app-window-drag",
    );
  });

  it('removes the navigation rail track when the session sidebar is collapsed', () => {
    expect(appSource).toContain("isSessionCollapsed ? 'session-collapsed' : ''");
    expect(appSource).toContain('className="nav-rail-reveal-zone"');
    expect(styles).toMatch(
      /\.app-shell\.session-collapsed\s*\{[\s\S]*?--nav-track-width:\s*0px/,
    );
    // 사이드 패널 트랙은 닫혀 있어도 0px로 존재한다 — 트랙 개수가 바뀌면
    // grid-template-columns가 보간되지 않고 점프한다.
    expect(styles).toMatch(
      /\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*\n?\s*var\(--nav-track-width\) minmax\(0, 1fr\)\s*\n?\s*var\(--app-side-panel-track, 0px\)/,
    );
    expect(styles).toMatch(
      /\.app-shell\.session-collapsed\.sidebar-collapse-ready \.nav-rail-reveal-zone\s*\{[\s\S]*?height:\s*min\(280px, 36vh\)[\s\S]*?top:\s*50%[\s\S]*?transform:\s*translateY\(-50%\)/,
    );
    expect(styles).toMatch(
      /\.app-shell\.session-collapsed\.sidebar-collapse-ready \.nav-rail\s*\{[\s\S]*?bottom:\s*auto[\s\S]*?top:\s*50%[\s\S]*?width:\s*58px/,
    );
    expect(appSource).toContain("'sidebar-collapse-ready'");
    expect(appSource).toContain('const SIDEBAR_COLLAPSE_DURATION_MS = 280');
    expect(appSource).toContain('}, SIDEBAR_COLLAPSE_DURATION_MS);');
    expect(appSource).toContain('onClickCapture={(event) => {');
    expect(appSource).toContain('setFloatingNavDismissed(true)');
    expect(appSource).toContain(
      'onMouseEnter={() => setFloatingNavDismissed(false)}',
    );
    expect(styles).toMatch(
      /\.app-shell\.session-collapsed:not\(\.sidebar-collapse-ready\) \.nav-rail\s*\{[^}]*opacity:\s*0[^}]*transform:\s*translateX/,
    );
  });

  it('reduces collapsed app side panels to a right-edge hover rail', () => {
    expect(appSource).toContain('className="app-side-panel-reveal-zone"');
    expect(appSource).toContain('<AnimatePresence initial={false}>');
    expect(appSource).toContain('key="app-side-panel"');
    expect(appSource).toContain('const shouldReduceMotion = useReducedMotion();');
    expect(appSource).toContain("initial={shouldReduceMotion ? false : { x: '100%' }}");
    expect(appSource).toMatch(
      /exit=\{\s*shouldReduceMotion\s*\|\|\s*isSidePanelPushed\s*\n?\s*\?\s*undefined\s*\n?\s*:\s*\{ x: '100%' \}/,
    );
    expect(appSource).toContain(
      'duration: SIDEBAR_COLLAPSE_DURATION_MS / 1000',
    );
    expect(appSource).toContain('ease: [0.4, 0, 0.2, 1]');
    expect(styles).toMatch(
      /\.app-shell\.side-panel-collapsed \.app-side-panel-reveal-zone\s*\{[\s\S]*?height:\s*96px[\s\S]*?right:\s*0[\s\S]*?top:\s*50%[\s\S]*?transform:\s*translateY\(-50%\)[\s\S]*?width:\s*12px/,
    );
    expect(styles).toMatch(
      /\.app-side-panel-collapsed\s*\{[\s\S]*?height:\s*76px[\s\S]*?opacity:\s*0[\s\S]*?pointer-events:\s*none[\s\S]*?right:\s*0[\s\S]*?top:\s*50%[\s\S]*?width:\s*28px/,
    );
    expect(styles).toMatch(
      /\.app-side-panel-toggle\s*\{[\s\S]*?height:\s*72px[\s\S]*?min-width:\s*24px[\s\S]*?width:\s*24px/,
    );
    expect(styles).toMatch(
      /\.app-side-panel-reveal-zone:hover\s*\+ \.app-side-panel-collapsed,[\s\S]*?\.app-side-panel-collapsed:focus-within\s*\{[\s\S]*?opacity:\s*1[\s\S]*?transform:\s*translate\(0, -50%\)/,
    );
  });

  it('joins the expanded navigation and memo list into one muted sidebar', () => {
    expect(styles).toMatch(
      /\.app-shell::before\s*\{[\s\S]*?background:\s*var\(--subnota-chrome-bg\)[\s\S]*?bottom:\s*0[\s\S]*?left:\s*0[\s\S]*?top:\s*0[\s\S]*?width:\s*var\(--sidebar-surface-width\)/,
    );
    expect(styles).toMatch(
      /\.app-shell:not\(\.session-collapsed\) \.nav-rail,[\s\S]*?\.session-rail-inner\s*\{[\s\S]*?background:\s*transparent[\s\S]*?border-radius:\s*0/,
    );
    expect(styles).toMatch(
      /\.app-shell:not\(\.session-collapsed\) \.session-rail\s*\{[\s\S]*?margin-right:\s*0/,
    );
  });

  it('keeps the memo rail within a resizable desktop width range', () => {
    expect(styles).toContain('--legacy-size-session-rail: 200px');
    expect(styles).toContain('--session-rail-width: var(--legacy-size-session-rail)');
    expect(styles).toContain('width: var(--session-rail-width, var(--legacy-size-session-rail))');
    expect(memoWorkspaceSource).toContain('SESSION_RAIL_MIN_WIDTH = 200');
    expect(memoWorkspaceSource).toContain('SESSION_RAIL_WIDTH = 200');
    expect(memoWorkspaceSource).toContain('SESSION_RAIL_MAX_WIDTH = 300');
    expect(memoWorkspaceSource).toContain('role="separator"');
    expect(appSource).toContain('sessionRailWidth={sessionRailWidth}');
    expect(appSource).toContain("isSessionRailResizing ? 'session-rail-resizing' : ''");
    expect(appSource).toContain("'--session-rail-width': `${sessionRailWidth}px`");
    expect(styles).toContain('.app-shell.session-rail-resizing::before');
    expect(styles).toContain('transition: none');
  });

  it('places new-tab below topics and groups sidebar modes as a vertical segment', () => {
    const labels = [
      "aria-label={t('메모'",
      "aria-label={t('캘린더'",
      "aria-label={t('링크'",
      'aria-label="Topics"',
      "aria-label={t('새 탭'",
      "t('목록'",
      "t('폴더'",
      'aria-label={updateActionLabel}',
      "aria-label={t('설정'",
    ];
    const positions = labels.map(label => appSource.indexOf(label));

    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(appSource).toContain('const openNewTabInFocusedSplitPane = () => {');
    expect(appSource).toContain("createEditorHelper('memo', { isViewPicker: true })");
    expect(appSource).toContain('editorsAfterNewTab(getAppPaneEditors(pane), nextEditor)');
    expect(appSource).toContain("root: 'nav-mode-segment nav-context-item'");
    expect(appSource).toContain("aria-label={t('메모 보기 방식', 'Memo view')}");
    expect(appSource).toContain('orientation="vertical"');
    expect(appSource).toContain('transitionDuration={200}');
    expect(appSource).toContain('withItemsBorders={false}');
    // 홈에 박힌 버튼은 홈을 가로질러 미끄러지지 않는다. layout 애니메이션은
    // transform으로 돌면서 그림자까지 눌러 찌그러뜨리기도 한다. 누른 자리에서
    // 솟아오르는 방식으로 바꿨다.
    expect(appSource).toContain('className="nav-mode-segment-motion-indicator"');
    expect(appSource).not.toContain('layoutId="nav-mode-segment-motion-indicator"');
    // 제자리에서 솟아오르는 짧은 전환. 이동이 없어 0.2초까지 끌 이유가 없다.
    expect(appSource).toContain('duration: 0.14');
    expect(workspaceSource).toContain('const tabLabel = editor.isViewPicker');
    expect(workspaceSource).toMatch(
      /const getMemoTabLabel = \(content: string, language: 'en' \| 'ko'\) =>/,
    );
    expect(workspaceSource).toContain(".find(Boolean);");
    expect(workspaceSource).toContain('title={tabLabel}');
    expect(workspaceSource).toContain('aria-label={tabLabel}');
    expect(styles).toMatch(
      /\.app-shell\.session-collapsed \.nav-context-item,[\s\S]*?\.nav-mode-divider\s*\{[\s\S]*?display:\s*none/,
    );
    // 트랙이 안으로 파이고 그 안에서 선택 칸이 솟는다. 파임을 담을 여백이
    // 필요해 padding 2px → 3px, 폭도 그만큼 넓어졌다.
    expect(styles).toMatch(
      /\.nav-mode-segment\s*\{[\s\S]*?padding:\s*3px[\s\S]*?width:\s*calc\(var\(--control-size-standard\) \+ 6px\)/,
    );
    expect(styles).toMatch(
      /\.nav-mode-segment\s*\{[\s\S]*?box-shadow:\s*var\(--app-color-state-inset-shadow\)/,
    );
    expect(styles).toMatch(
      /\.nav-mode-segment-motion-indicator\s*\{[\s\S]*?position:\s*absolute/,
    );
    expect(memoWorkspaceSource).not.toContain('className="session-tabs"');
    expect(styles).not.toContain('.session-tabs {');
    expect(styles).toMatch(
      /\.session-list\s*\{[\s\S]*?flex:\s*1[\s\S]*?padding:\s*2px 2px 28px/,
    );
  });

  it('keeps settings separate from the direct update action', () => {
    expect(appSource).toContain('className="nav-item nav-utility nav-update-action"');
    expect(appSource).toContain('onClick={() => void startAvailableUpdate()}');
    expect(appSource).toContain('disabled={isUpdateWorking}');
    expect(appSource).toContain("aria-label={t('설정', 'Settings')}");
    expect(appSource).not.toContain('checkForAvailableUpdate(true)');
  });

  it('places pane tabs at the top while keeping the first tab clear of global controls', () => {
    expect(styles).toMatch(
      /\.app-shell\s*\{[\s\S]*?padding:\s*0/,
    );
    expect(styles).toMatch(
      /\.split-workspace-commandbar\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(styles).toMatch(
      /\.split-workspace-commandbar\s*\{[\s\S]*?-webkit-app-region:\s*no-drag/,
    );
    expect(styles).toMatch(
      /\.app-window-drag\s*\{[\s\S]*?height:\s*14px[\s\S]*?-webkit-app-region:\s*drag/,
    );
    expect(styles).not.toMatch(
      /\.split-pane\s*\{[^}]*padding-top:\s*var\(--legacy-size-commandbar\)/,
    );
    expect(styles).toMatch(
      /\.split-workspace-commandbar\.session-collapsed\s*\+[\s\S]*?\.split-workspace-container\s*>\s*\.split-pane:first-child[\s\S]*?\.split-pane-header\s*\{[\s\S]*?padding-left:\s*var\(--legacy-size-commandbar-content\)/,
    );
    expect(styles).toMatch(
      /\.split-pane-titlebar-drag\s*\{[\s\S]*?-webkit-app-region:\s*drag/,
    );
    expect(styles).toMatch(
      /\.split-editor-tabs-drag-spacer\s*\{[\s\S]*?-webkit-app-region:\s*drag/,
    );
    expect(styles).toMatch(
      /\.split-editor-tab,[\s\S]*?\.split-pane-actions\s*\{[^}]*-webkit-app-region:\s*no-drag/,
    );
    expect(styles).toMatch(
      /\.session-toggle-button\s*\{[^}]*pointer-events:\s*auto[^}]*-webkit-app-region:\s*no-drag/,
    );
    expect(styles).toMatch(
      /\.split-pane-header\s*\{[\s\S]*?background:\s*transparent[\s\S]*?border-bottom:\s*0[\s\S]*?-webkit-app-region:\s*no-drag/,
    );
    expect(styles).toMatch(/--legacy-size-commandbar-content:\s*220px/);
    expect(workspaceSource).toContain(
      "isSessionCollapsed ? ' session-collapsed' : ''",
    );
    expect(styles).toMatch(
      /@container split-pane \(max-width:\s*380px\)[\s\S]*?\.split-workspace-container\.session-collapsed[\s\S]*?\.split-pane-actions\s*\{[\s\S]*?display:\s*none/,
    );
    expect(styles).toMatch(
      /@container split-pane \(max-width:\s*380px\)[\s\S]*?\.split-editor-tabs-scroll\s*\{[\s\S]*?min-width:\s*52px/,
    );
  });
});
