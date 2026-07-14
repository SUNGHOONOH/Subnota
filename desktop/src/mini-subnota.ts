// Mini Subnota: a dedicated floating quick-capture panel, system-wide global
// hotkeys, and AppleScript browser-page capture — ported from the legacy RN
// macOS AppDelegate (NSPanel + Carbon hotkeys + osascript) onto Electron APIs.

import { BrowserWindow, globalShortcut, screen } from 'electron';
import type { Rectangle } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ShortcutSettings } from './lib/shortcutSettings';

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

export interface MiniSubnotaOptions {
  preloadPath: string;
  getAnchorBounds?: () => Rectangle | null;
  getRecentInboxItems?: () => MiniRecentInboxItem[];
  loadRenderer: (window: BrowserWindow, hash: string) => void;
  onCapture: (payload: { url: string; title: string }) => void;
  onCaptureError: (message: string) => void;
  onReveal?: () => void;
}

let options: MiniSubnotaOptions | null = null;
let miniWindow: BrowserWindow | null = null;

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
      window.show();
      window.focus();
      options?.onReveal?.();
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
    window.show();
    window.focus();
    options?.onReveal?.();
  };

  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', reveal);
  } else {
    reveal();
  }
};

export const toggleMiniWindow = () => {
  if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
    miniWindow.hide();
    return;
  }
  showMiniForMemo();
};

export const hideMiniWindow = () => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.hide();
  }
};

const runOsascript = async (script: string) => {
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  return stdout.trim();
};

export const captureCurrentBrowserPage = async () => {
  if (!options) {
    return;
  }

  updateMiniStatus('현재 페이지를 확인하는 중입니다.');

  if (process.platform !== 'darwin') {
    const message = '현재 페이지 저장은 macOS에서만 지원됩니다.';
    updateMiniStatus(message, { reveal: true });
    options.onCaptureError(message);
    return;
  }

  try {
    const bundleId = await runOsascript(FRONTMOST_BUNDLE_ID_SCRIPT);
    const script = getBrowserCaptureScript(bundleId);
    if (!script) {
      const message =
        '지원하는 브라우저의 현재 페이지를 찾지 못했습니다. Safari, Chrome, Arc, Edge, Brave에서 다시 시도해 주세요.';
      updateMiniStatus(message, { reveal: true });
      options.onCaptureError(message);
      return;
    }

    const output = await runOsascript(script);
    const { title, url } = parseBrowserPageOutput(output);
    if (!url) {
      const message = '현재 탭의 URL을 가져오지 못했습니다.';
      updateMiniStatus(message, { reveal: true });
      options.onCaptureError(message);
      return;
    }

    options.onCapture({ url, title });
    updateMiniStatus('수집함에 저장 요청을 보냈습니다.', { reveal: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? `브라우저 정보를 가져오지 못했습니다: ${error.message}`
        : '브라우저 정보를 가져오지 못했습니다.';
    updateMiniStatus(message, { reveal: true });
    options.onCaptureError(message);
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
