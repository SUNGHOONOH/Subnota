// Quick Subnota: a dedicated floating quick-capture panel, system-wide global
// hotkeys, and AppleScript browser-page capture — ported from the legacy RN
// macOS AppDelegate (NSPanel + Carbon hotkeys + osascript) onto Electron APIs.

import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import type { Rectangle } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ShortcutSettings } from './lib/shortcutSettings';
import { normalizeWebUrl } from './lib/url-policy';

const execFileAsync = promisify(execFile);

const MINI_WIDTH = 380;
const MINI_HEIGHT = 320;
const MINI_MARGIN = 16;

const FRONTMOST_BUNDLE_ID_SCRIPT = [
  'use framework "AppKit"',
  "set workspace to current application's NSWorkspace's sharedWorkspace()",
  "set frontApp to workspace's frontmostApplication()",
  "return frontApp's bundleIdentifier() as text",
].join('\n');

// Frontmost-browser AppleScripts, ported verbatim from the legacy AppDelegate.
const BROWSER_SCRIPTS: Record<string, string> = {
  'com.apple.Safari':
    'tell application "Safari" to if exists front document then return URL of front document & "\\n" & name of front document',
  'com.google.Chrome':
    'tell application "Google Chrome" to if exists active tab of front window then return URL of active tab of front window & "\\n" & title of active tab of front window',
  'company.thebrowser.Browser':
    'tell application "Arc" to if exists active tab of front window then return URL of active tab of front window & "\\n" & title of active tab of front window',
  'com.microsoft.edgemac':
    'tell application "Microsoft Edge" to if exists active tab of front window then return URL of active tab of front window & "\\n" & title of active tab of front window',
  'com.brave.Browser':
    'tell application "Brave Browser" to if exists active tab of front window then return URL of active tab of front window & "\\n" & title of active tab of front window',
};

export const getBrowserCaptureScript = (bundleId: string) =>
  BROWSER_SCRIPTS[bundleId] ?? null;

export const parseBrowserPageOutput = (output: string) => {
  const [url = '', title = ''] = output.split('\n');
  return { title, url };
};

export interface MiniRecentInboxItem {
  title: string;
  url: string;
  sourceLabel: string;
}

export interface MiniFocusContext {
  focusedMainWindowId: number | null;
}

export interface MiniSubnotaOptions {
  getFocusContext?: () => MiniFocusContext;
  preloadPath: string;
  getAnchorBounds?: () => Rectangle | null;
  getRecentInboxItems?: () => MiniRecentInboxItem[];
  loadRenderer: (window: BrowserWindow, hash: string) => void;
  onCapture: (payload: { url: string; title: string }) => void;
  onCaptureError: (message: string) => void;
  /** 캡처를 시작했다. 트레이가 "담는 중"을 표시할 수 있게 알린다. */
  onCaptureStart?: () => void;
  onReveal?: () => void;
  restoreMainWindowFocus?: (windowId: number) => void;
}

type MiniDismissalTarget =
  | { kind: 'external-app'; bundleId: string | null }
  | { kind: 'main-window'; windowId: number }
  | { kind: 'none' };

let options: MiniSubnotaOptions | null = null;
let miniWindow: BrowserWindow | null = null;
let miniDismissalTarget: MiniDismissalTarget = { kind: 'none' };
let miniRevealPromise: Promise<void> | null = null;

export const setupMiniSubnota = (next: MiniSubnotaOptions) => {
  options = next;
};

export const updateMiniRecentInbox = (items: MiniRecentInboxItem[]) => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('mini-recent-inbox', items);
  }
};

export const updateMiniStatus = (
  message: string,
  config: { reveal?: boolean } = {},
) => {
  if (!options) {
    return;
  }

  const shouldReveal = config.reveal === true;
  const window = shouldReveal ? ensureMiniWindow(options) : miniWindow;
  if (!window || window.isDestroyed()) {
    return;
  }
  if (!shouldReveal && !window.isVisible()) {
    return;
  }

  const sendStatus = () => {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send('mini-status', message);
    window.webContents.send(
      'mini-recent-inbox',
      options?.getRecentInboxItems?.() ?? [],
    );
    if (shouldReveal) {
      void revealMiniWindow(window).then(() => options?.onReveal?.());
    }
  };

  if (shouldReveal) {
    positionMiniWindow(window);
  }
  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', sendStatus);
  } else {
    sendStatus();
  }
};

export const getMiniWindowType = (
  platform: NodeJS.Platform = process.platform,
) => (platform === 'darwin' ? 'panel' : undefined);

/**
 * Mini 창을 띄우고 키보드 포커스까지 가져온다.
 *
 * macOS에서 Mini는 NSPanel(`type: 'panel'`)이다. 앱이 백그라운드일 때는
 * 패널이 key window가 되지 못해, 창은 떴는데 타이핑은 직전 앱(에디터·터미널)에
 * 그대로 들어간다. 전역 단축키로 부르는 창이라 이 상황이 기본값이다.
 * `app.focus({ steal: true })`로 앱을 먼저 활성화해야 패널이 입력을 받는다.
 */
const revealMiniWindow = (window: BrowserWindow) => {
  if (window.isVisible()) {
    window.focus();
    return Promise.resolve();
  }
  if (miniRevealPromise) {
    return miniRevealPromise;
  }

  miniRevealPromise = (async () => {
    // `app.focus({ steal: true })`보다 먼저 기록해야, Mini를 연 뒤 Subnota가
    // 최전면 앱으로 바뀐 상태를 이전 창으로 오인하지 않는다.
    miniDismissalTarget = await captureMiniDismissalTarget();
    if (window.isDestroyed()) {
      return;
    }
    if (process.platform === 'darwin') {
      app.focus({ steal: true });
    }
    window.show();
    window.focus();
  })().finally(() => {
    miniRevealPromise = null;
  });

  return miniRevealPromise;
};

const buildMiniWindow = (config: MiniSubnotaOptions) => {
  const window = new BrowserWindow({
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    type: getMiniWindowType(),
    webPreferences: {
      preload: config.preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Float above normal windows and dismiss when focus is lost, mirroring the
  // legacy NSFloatingWindowLevel / hidesOnDeactivate panel behaviour.
  window.setAlwaysOnTop(true, 'floating');
  window.on('blur', () => {
    if (!window.isDestroyed()) {
      window.hide();
    }
  });
  window.on('closed', () => {
    miniWindow = null;
  });

  config.loadRenderer(window, 'mini');
  return window;
};

export const calculateMiniWindowPosition = (
  anchorBounds: Rectangle | null | undefined,
  workArea: Rectangle,
) => {
  if (anchorBounds && anchorBounds.width > 0 && anchorBounds.height > 0) {
    return {
      x: Math.round(
        Math.min(
          Math.max(
            workArea.x + MINI_MARGIN,
            anchorBounds.x + anchorBounds.width / 2 - MINI_WIDTH + 52,
          ),
          workArea.x + workArea.width - MINI_WIDTH - MINI_MARGIN,
        ),
      ),
      y: Math.round(
        Math.max(
          workArea.y + MINI_MARGIN,
          anchorBounds.y - MINI_HEIGHT - 8,
        ),
      ),
    };
  }

  return {
    x: Math.round(workArea.x + workArea.width - MINI_WIDTH - MINI_MARGIN),
    y: Math.round(workArea.y + MINI_MARGIN),
  };
};

const getMiniWorkArea = (anchorBounds: Rectangle | null | undefined) => {
  if (anchorBounds && anchorBounds.width > 0 && anchorBounds.height > 0) {
    return screen.getDisplayNearestPoint({
      x: Math.round(anchorBounds.x + anchorBounds.width / 2),
      y: Math.round(anchorBounds.y + anchorBounds.height / 2),
    }).workArea;
  }

  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
};

const positionMiniWindow = (window: BrowserWindow) => {
  const anchorBounds = options?.getAnchorBounds?.() ?? null;
  const position = calculateMiniWindowPosition(
    anchorBounds,
    getMiniWorkArea(anchorBounds),
  );
  window.setPosition(position.x, position.y);
};

const ensureMiniWindow = (config: MiniSubnotaOptions) => {
  if (!miniWindow || miniWindow.isDestroyed()) {
    miniWindow = buildMiniWindow(config);
  }
  return miniWindow;
};

export const showMiniForMemo = (prefill = '') => {
  if (!options) {
    return;
  }

  const window = ensureMiniWindow(options);
  positionMiniWindow(window);

  const reveal = () => {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send('mini-prefill', prefill);
    window.webContents.send(
      'mini-recent-inbox',
      options?.getRecentInboxItems?.() ?? [],
    );
    void revealMiniWindow(window).then(() => options?.onReveal?.());
  };

  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', reveal);
  } else {
    reveal();
  }
};

export const toggleMiniWindow = () => {
  if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
    hideMiniWindow();
    return;
  }
  showMiniForMemo();
};

export const hideMiniWindow = () => {
  if (!miniWindow || miniWindow.isDestroyed() || !miniWindow.isVisible()) return;

  const dismissalTarget = miniDismissalTarget;
  miniDismissalTarget = { kind: 'none' };
  const window = miniWindow;

  // 외부 앱으로 돌아갈 때는 **그 앱을 먼저 활성화하고** 닫는다.
  //
  // Quick을 먼저 숨기면 Subnota가 아직 활성 앱이라 macOS가 같은 앱의 다음
  // 창 — 열려 있던 메인 창 — 을 key로 올린다. 그 뒤 활성화 osascript가
  // 끝나야 원래 앱으로 넘어가므로, 메인 창이 떴다 사라지는 깜빡임이 보인다.
  // 메인 창을 닫아 둔 경우에는 올릴 창이 없어 이 증상이 없었다.
  //
  // 순서를 뒤집으면 Subnota가 활성 앱에서 먼저 빠지므로 올라올 창이 없다.
  // 대상 앱이 앞으로 나오는 순간 Quick은 blur로 스스로 숨고, 아래 hide는
  // 활성화가 실패했을 때를 위한 안전망이다.
  if (dismissalTarget.kind === 'external-app') {
    void restoreMiniFocus(dismissalTarget).finally(() => {
      if (!window.isDestroyed() && window.isVisible()) {
        window.hide();
      }
    });
    return;
  }

  window.hide();
  void restoreMiniFocus(dismissalTarget);
};

export const isMiniSubnotaWebContents = (webContentsId: number) =>
  Boolean(
    miniWindow &&
      !miniWindow.isDestroyed() &&
      miniWindow.webContents.id === webContentsId,
  );

const runOsascript = async (script: string) => {
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  return stdout.trim();
};

const BUNDLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;

const getFrontmostApplicationBundleId = async () => {
  if (process.platform !== 'darwin') return null;
  try {
    const bundleId = await runOsascript(FRONTMOST_BUNDLE_ID_SCRIPT);
    return BUNDLE_ID_PATTERN.test(bundleId) ? bundleId : null;
  } catch {
    return null;
  }
};

// `tell application … to activate`는 대상 앱별 Automation 권한을 요구할 수
// 있다. NSRunningApplication을 통해 이미 실행 중인 앱만 활성화하면 그 권한
// 없이 이전 작업 창으로 돌아갈 수 있고, 사용자가 방금 종료한 앱을 되살리지도 않는다.
const activateRunningApplication = async (bundleId: string) => {
  if (process.platform !== 'darwin' || !BUNDLE_ID_PATTERN.test(bundleId)) {
    return false;
  }
  try {
    const result = await runOsascript(
      [
        'use framework "AppKit"',
        `set runningApps to current application's NSRunningApplication's runningApplicationsWithBundleIdentifier:"${bundleId}"`,
        'if (count of runningApps) is 0 then return false',
        'set targetApp to item 1 of runningApps',
        "return (targetApp's activateWithOptions:0) as boolean",
      ].join('\n'),
    );
    return result === 'true';
  } catch {
    return false;
  }
};

export const decideMiniDismissalTarget = (
  focusContext: MiniFocusContext,
  appIsActive: boolean,
  externalBundleId: string | null,
): MiniDismissalTarget => {
  if (focusContext.focusedMainWindowId !== null) {
    return { kind: 'main-window', windowId: focusContext.focusedMainWindowId };
  }
  if (appIsActive) {
    return { kind: 'none' };
  }
  return { kind: 'external-app', bundleId: externalBundleId };
};

const captureMiniDismissalTarget = async (): Promise<MiniDismissalTarget> => {
  const focusContext = options?.getFocusContext?.() ?? {
    focusedMainWindowId: null,
  };
  const appIsActive = process.platform === 'darwin' && app.isActive();
  if (focusContext.focusedMainWindowId !== null || appIsActive) {
    return decideMiniDismissalTarget(focusContext, appIsActive, null);
  }

  const bundleId = await getFrontmostApplicationBundleId();
  rememberFrontmostBrowser(bundleId);
  return decideMiniDismissalTarget(focusContext, false, bundleId);
};

const restoreMiniFocus = async (target: MiniDismissalTarget) => {
  if (process.platform !== 'darwin') return;

  if (target.kind === 'main-window') {
    options?.restoreMainWindowFocus?.(target.windowId);
    return;
  }

  if (target.kind === 'external-app') {
    if (target.bundleId && await activateRunningApplication(target.bundleId)) {
      return;
    }
    // 이전 앱이 그 사이 종료됐거나 macOS가 활성화를 거절한 경우에는 Subnota를
    // 앞에 남기지 않는다. app.hide()는 모든 Subnota 창을 감추고 직전 앱으로
    // 돌아가게 하는 macOS의 안전한 폴백이다.
    app.hide();
  }
};

// Mini가 열리기 직전에 앞에 있던 브라우저. 창 안의 "현재 페이지 저장"
// 버튼을 누르면 Mini(=Subnota)가 최전면일 수 있어 frontmostApplication이
// 브라우저를 가리키지 않는다. 전역 단축키 경로는 여전히 실시간 조회를
// 먼저 쓰고, 이 값은 그때만 쓰는 대비책이다.
let lastBrowserBundleId: string | null = null;

const rememberFrontmostBrowser = (bundleId: string | null) => {
  // 지원 브라우저일 때만 기억한다 — Subnota 자신을 저장하면 의미가 없다.
  if (bundleId && getBrowserCaptureScript(bundleId)) {
    lastBrowserBundleId = bundleId;
  }
};

export const captureCurrentBrowserPage = async (
  config: { allowRememberedApp?: boolean } = {},
) => {
  if (!options) {
    return;
  }

  // Quick 창은 띄우지 않는다. 클리핑은 브라우저를 보는 중에 일어나므로
  // 여기서 창을 열면 그것이 곧 방해다. 진행·결과는 트레이가 알린다
  // (`onCaptureStart` → 메뉴바 표시). 창이 마침 열려 있으면 상태줄에도 남는다.
  options.onCaptureStart?.();
  updateMiniStatus('현재 페이지를 확인하는 중입니다.');

  const fail = (message: string) => {
    updateMiniStatus(message);
    options?.onCaptureError(message);
  };

  if (process.platform !== 'darwin') {
    fail('현재 페이지 저장은 macOS에서만 지원됩니다.');
    return;
  }

  try {
    const bundleId = await runOsascript(FRONTMOST_BUNDLE_ID_SCRIPT);
    const script =
      getBrowserCaptureScript(bundleId) ??
      (config.allowRememberedApp && lastBrowserBundleId
        ? getBrowserCaptureScript(lastBrowserBundleId)
        : null);
    if (!script) {
      fail(
        '지원하는 브라우저의 현재 페이지를 찾지 못했습니다. Safari, Chrome, Arc, Edge, Brave에서 다시 시도해 주세요.',
      );
      return;
    }

    const output = await runOsascript(script);
    const { title, url } = parseBrowserPageOutput(output);
    const normalizedUrl = normalizeWebUrl(url);
    if (!normalizedUrl) {
      fail('웹페이지 주소만 저장할 수 있습니다. 브라우저 내부 페이지나 로컬 파일은 지원하지 않습니다.');
      return;
    }

    options.onCapture({ url: normalizedUrl, title: title.slice(0, 500) });
    updateMiniStatus('링크를 담는 중입니다.');
  } catch (error) {
    fail(
      error instanceof Error
        ? `브라우저 정보를 가져오지 못했습니다: ${error.message}`
        : '브라우저 정보를 가져오지 못했습니다.',
    );
  }
};

export interface GlobalShortcutHandlers {
  onToggleMemo: () => void;
  onCapture: () => void;
}

const registerShortcut = (accelerator: string, callback: () => void) => {
  try {
    return globalShortcut.register(accelerator, callback);
  } catch {
    return false;
  }
};

export const registerGlobalShortcuts = (
  handlers: GlobalShortcutHandlers,
  shortcuts: ShortcutSettings,
  features: { capture: boolean } = { capture: true },
) => {
  const toggle = registerShortcut(shortcuts.toggleMini, handlers.onToggleMemo);
  const capture = features.capture
    ? registerShortcut(shortcuts.capturePage, handlers.onCapture)
    : true;
  return { capture, toggle };
};

export const unregisterGlobalShortcuts = () => {
  globalShortcut.unregisterAll();
};
