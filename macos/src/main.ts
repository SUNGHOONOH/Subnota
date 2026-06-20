import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell,
} from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { checkForNativeUpdate, configureAutoUpdater, installNativeUpdate } from './auto-updater';
import { checkForUpdate } from './update-checker';
import { attachCloseHandler } from './window-close-handler';
import { parseSubnotaUrl } from './deep-link';
import {
  captureCurrentBrowserPage,
  hideMiniWindow,
  registerGlobalShortcuts,
  setupMiniSubnota,
  showMiniForMemo,
  toggleMiniWindow,
  unregisterGlobalShortcuts,
  updateMiniRecentInbox,
  updateMiniStatus,
} from './mini-subnota';
import {
  DEFAULT_SHORTCUT_SETTINGS,
  GlobalShortcutUpdateResult,
  ShortcutSettings,
  normalizeShortcutSettings,
} from './lib/shortcutSettings';
import {
  MAIN_MIN_SIZE,
  createPreferredMainWindowBounds,
} from './lib/windowBounds';

// No-op on macOS; only handles installer startup events on Windows builds.
if (started) {
  app.quit();
}

const pendingFilePaths: string[] = [];
const pendingDeepLinks: string[] = [];
let appReady = false;
let tray: Tray | null = null;
let trayMenu: Menu | null = null;
let shortcutSettings = DEFAULT_SHORTCUT_SETTINGS;
const authWindowBounds = new Map<number, Electron.Rectangle>();
const windowFilePaths = new Map<number, string>();
const mainWindows = new Set<BrowserWindow>();

const AUTH_WINDOW_SIZE = { height: 720, width: 1000 };

const getPrimaryWorkArea = () => {
  const display = screen.getPrimaryDisplay();
  return display.workArea ?? {
    height: display.workAreaSize.height,
    width: display.workAreaSize.width,
    x: 0,
    y: 0,
  };
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const collectDeepLinksFromArgv = (argv: string[]) =>
  argv.filter(arg => arg.startsWith('subnota://'));

app.on('second-instance', (_event, argv) => {
  for (const url of collectDeepLinksFromArgv(argv)) {
    if (appReady) {
      handleDeepLink(url);
    } else {
      pendingDeepLinks.push(url);
    }
  }

  const mainWindow = getMainWindow();
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
});

// Must be registered before 'ready' to catch files opened at launch on macOS.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (appReady) {
    createWindow(filePath);
  } else {
    pendingFilePaths.push(filePath);
  }
});

// macOS delivers subnota:// deep links via open-url; queue them until ready.
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (appReady) {
    handleDeepLink(url);
  } else {
    pendingDeepLinks.push(url);
  }
});

// Authorization Code + PKCE flow (RFC 8252). The renderer builds the provider
// authorize URL (storing the PKCE verifier in its own client) and passes it
// here. We open it in the SYSTEM browser — Google blocks OAuth/2FA inside
// embedded webviews ("disallowed_useragent") — and capture the
// http://localhost:<port>/auth/callback?code=... redirect on a short-lived
// loopback server, returning the one-time code for the renderer to exchange.
const OAUTH_LOOPBACK_PORT = 8923;

const oauthResultHtml = (succeeded: boolean) =>
  '<!doctype html><meta charset="utf-8">' +
  '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
  'background:#faf9f5;color:#141413;text-align:center;padding-top:96px">' +
  `<h2>${succeeded ? '로그인이 완료되었습니다' : '로그인을 완료하지 못했습니다'}</h2>` +
  '<p style="color:#6c6a64">이 창을 닫고 Subnota로 돌아가세요.</p></body>';

// Lets the renderer abort an in-flight OAuth wait (e.g. the user gave up in the
// browser), freeing the loopback port and unblocking the login buttons.
let cancelActiveOAuth: (() => void) | null = null;

ipcMain.handle('cancel-oauth', () => {
  cancelActiveOAuth?.();
});

ipcMain.handle('start-oauth', async (_, authUrl: string) => {
  cancelActiveOAuth?.();
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const server = http.createServer((req, res) => {
      let url: URL;
      try {
        url = new URL(req.url ?? '/', `http://localhost:${OAUTH_LOOPBACK_PORT}`);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }

      if (url.pathname !== '/auth/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const errorDescription = url.searchParams.get('error_description') ?? url.searchParams.get('error');
      const succeeded = Boolean(code) && !errorDescription;
      res.writeHead(succeeded ? 200 : 400, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      res.end(oauthResultHtml(succeeded));

      if (errorDescription) {
        finish(() => reject(new Error(errorDescription)));
      } else if (code) {
        finish(() => resolve(code));
      } else {
        finish(() => reject(new Error('로그인 응답에서 코드를 찾지 못했습니다.')));
      }

      for (const window of BrowserWindow.getAllWindows()) {
        window.show();
      }
    });

    server.on('error', error => {
      const oauthError =
        (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
          ? new Error('로그인 콜백 포트가 사용 중입니다. 잠시 후 다시 시도해 주세요.')
          : error;
      finish(() => reject(oauthError));
    });
    const timer = setTimeout(
      () => finish(() => reject(new Error('소셜 로그인이 취소되었습니다.'))),
      5 * 60 * 1000,
    );
    cancelActiveOAuth = () => finish(() => reject(new Error('소셜 로그인이 취소되었습니다.')));
    server.listen(OAUTH_LOOPBACK_PORT, 'localhost', async () => {
      try {
        await shell.openExternal(authUrl);
      } catch (error) {
        finish(() =>
          reject(
            error instanceof Error
              ? error
              : new Error('기본 브라우저를 열지 못했습니다.'),
          ),
        );
      }
    });

    function finish(fn: () => void) {
      if (settled) {
        return;
      }
      settled = true;
      cancelActiveOAuth = null;
      clearTimeout(timer);
      if (server.listening) {
        server.close();
      }
      fn();
    }
  });
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return { path: filePath, content };
});

ipcMain.handle('save-file', async (_, filePath: string, content: string) => {
  await fs.promises.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('check-for-update', () => {
  if (checkForNativeUpdate()) return null;
  return checkForUpdate();
});

ipcMain.handle('install-update', () => installNativeUpdate());

ipcMain.handle('open-external', async (_, url: string) => {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
      return false;
    }
    await shell.openExternal(parsedUrl.toString());
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('open-local-file', (_, filePath: string) => {
  if (!/\.(md|markdown)$/i.test(filePath)) return false;
  if (!fs.existsSync(filePath)) return false;
  createWindow(filePath);
  return true;
});

ipcMain.handle('set-file-path', (event, filePath: string) => {
  windowFilePaths.set(event.sender.id, filePath);
});

ipcMain.handle('set-auth-window-mode', (event, isAuthMode: boolean) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (isAuthMode) {
    if (!authWindowBounds.has(window.id)) {
      authWindowBounds.set(window.id, window.getBounds());
    }

    const bounds = window.getBounds();
    const nextX = Math.round(
      bounds.x + (bounds.width - AUTH_WINDOW_SIZE.width) / 2,
    );
    const nextY = Math.round(
      bounds.y + (bounds.height - AUTH_WINDOW_SIZE.height) / 2,
    );

    window.setMinimumSize(AUTH_WINDOW_SIZE.width, AUTH_WINDOW_SIZE.height);
    window.setMaximumSize(AUTH_WINDOW_SIZE.width, AUTH_WINDOW_SIZE.height);
    window.setBounds({
      height: AUTH_WINDOW_SIZE.height,
      width: AUTH_WINDOW_SIZE.width,
      x: nextX,
      y: nextY,
    }, true);
    return true;
  }

  window.setMaximumSize(0, 0);
  window.setMinimumSize(MAIN_MIN_SIZE.width, MAIN_MIN_SIZE.height);
  const previousBounds = authWindowBounds.get(window.id);
  if (previousBounds) {
    window.setBounds(previousBounds, true);
    authWindowBounds.delete(window.id);
  }
  return true;
});

ipcMain.on('mini-close', () => {
  hideMiniWindow();
});

ipcMain.on('mini-saved', () => {
  broadcastToMainWindows('memos-updated');
});

ipcMain.on('open-main-window', () => {
  const mainWindow = getMainWindow() ?? createWindow();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('open-settings-window', () => {
  openSettingsWindow();
});

ipcMain.on('record-inbox-save', (_event, item: RecentInboxItem) => {
  recordInboxSave(item);
});

const shortcutHandlers: { onCapture: () => void; onToggleMemo: () => void } = {
  onCapture: () => void captureCurrentBrowserPage(),
  onToggleMemo: () => toggleMiniWindow(),
};

const applyGlobalShortcutSettings = (
  nextSettings: ShortcutSettings,
): GlobalShortcutUpdateResult => {
  unregisterGlobalShortcuts();
  const registered = registerGlobalShortcuts(shortcutHandlers, nextSettings);

  return {
    registered,
    settings: nextSettings,
  };
};

ipcMain.handle(
  'set-global-shortcuts',
  (_event, nextSettings: Partial<ShortcutSettings>) => {
    const normalized = normalizeShortcutSettings(nextSettings);
    const result = applyGlobalShortcutSettings(normalized);

    if (!result.registered.capture || !result.registered.toggle) {
      return applyGlobalShortcutSettings(shortcutSettings);
    }

    shortcutSettings = normalized;
    installApplicationMenu();
    buildTrayMenu();
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('shortcut-settings-changed', shortcutSettings);
      }
    }
    return result;
  },
);

const loadRenderer = (window: BrowserWindow, hash?: string) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = hash
      ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#${hash}`
      : MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const load = () => window.loadURL(url);
    // Retry on ERR_CONNECTION_REFUSED (-102): Vite may still be re-optimizing
    // deps on first run after installing packages.
    window.webContents.on('did-fail-load', (_, errorCode) => {
      if (errorCode === -102) setTimeout(load, 1000);
    });
    load();
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      hash ? { hash } : undefined,
    );
  }
};

const createWindow = (filePath?: string) => {
  const bounds = createPreferredMainWindowBounds(getPrimaryWorkArea());

  const mainWindow = new BrowserWindow({
    ...bounds,
    minHeight: MAIN_MIN_SIZE.height,
    minWidth: MAIN_MIN_SIZE.width,
    title: 'Subnota',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  attachCloseHandler(mainWindow);
  mainWindows.add(mainWindow);
  mainWindow.on('closed', () => {
    mainWindows.delete(mainWindow);
  });

  if (filePath) {
    windowFilePaths.set(mainWindow.webContents.id, filePath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    const storedPath = windowFilePaths.get(mainWindow.webContents.id);
    if (storedPath) mainWindow.webContents.send('file-opened', storedPath);
  });

  loadRenderer(mainWindow);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  return mainWindow;
};

const getMainWindow = () => {
  return Array.from(mainWindows).find(window => !window.isDestroyed()) ?? null;
};

const sendToMainWindow = (channel: string, payload?: unknown) => {
  const mainWindow = getMainWindow() ?? createWindow();

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();

  const send = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
};

const openSettingsWindow = () => {
  sendToMainWindow('open-settings');
};

const broadcastToMainWindows = (channel: string, payload?: unknown) => {
  for (const window of mainWindows) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
};

const handleDeepLink = (raw: string) => {
  const link = parseSubnotaUrl(raw);
  if (!link) {
    return;
  }
  if (link.kind === 'memo') {
    showMiniForMemo(link.text);
  } else {
    sendToMainWindow('inbox-capture', { title: link.title, url: link.url });
  }
};

const installApplicationMenu = () => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Subnota',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          accelerator: shortcutSettings.toggleMini,
          click: () => showMiniForMemo(),
          label: 'New Mini Subnota',
        },
        {
          accelerator: shortcutSettings.capturePage,
          click: () => void captureCurrentBrowserPage(),
          label: '현재 페이지 저장',
        },
        { type: 'separator' },
        {
          accelerator: 'CommandOrControl+,',
          click: openSettingsWindow,
          label: 'Settings...',
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          accelerator: 'CommandOrControl+N',
          click: () => createWindow(),
          label: 'New Window',
        },
        {
          accelerator: shortcutSettings.toggleMini,
          click: () => showMiniForMemo(),
          label: 'New Mini Subnota',
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);

  Menu.setApplicationMenu(menu);
};

interface RecentInboxItem {
  summaryStatus?: 'pending' | 'ready' | 'partial' | 'unsupported' | 'failed';
  title: string;
  url: string;
  sourceLabel: string;
}

let recentInboxItems: RecentInboxItem[] = [];
let hasUnreadInbox = false;
let unreadPulseTimers: Array<ReturnType<typeof setTimeout>> = [];

const renderUnreadInboxTitle = (visible = hasUnreadInbox) => {
  if (tray) {
    tray.setTitle(visible ? ' •' : '');
  }
};

const clearUnreadPulseTimers = () => {
  for (const timer of unreadPulseTimers) {
    clearTimeout(timer);
  }
  unreadPulseTimers = [];
};

const setUnreadInbox = (value: boolean) => {
  hasUnreadInbox = value;
  clearUnreadPulseTimers();
  // The macOS tray title renders next to the icon, mirroring the legacy "S•".
  renderUnreadInboxTitle();
};

const pulseUnreadInboxBadge = () => {
  if (!tray || !hasUnreadInbox) {
    return;
  }

  clearUnreadPulseTimers();
  const frames = [false, true, false, true, true];
  unreadPulseTimers = frames.map((visible, index) =>
    setTimeout(() => {
      if (hasUnreadInbox) {
        renderUnreadInboxTitle(visible);
      }
    }, (index + 1) * 180),
  );
};

const getInboxSaveStatusMessage = (item: RecentInboxItem) => {
  if (item.summaryStatus === 'partial') {
    return '링크와 메타데이터를 저장했습니다. 본문 요약은 제한적입니다.';
  }
  if (item.summaryStatus === 'failed' || item.summaryStatus === 'unsupported') {
    return '링크는 저장했습니다. 요약은 생성하지 못했습니다.';
  }
  if (item.summaryStatus === 'pending') {
    return '링크를 저장했습니다. 요약을 준비 중입니다.';
  }
  return `${item.sourceLabel || '링크'} 수집함에 저장됨`;
};

const truncateLabel = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const buildTrayMenu = () => {
  if (!tray) {
    return;
  }

  const recentEntries = recentInboxItems.length
    ? recentInboxItems.map((item) => ({
        click: () => void shell.openExternal(item.url),
        label: `${item.sourceLabel}  ${truncateLabel(item.title, 42)}`,
      }))
    : [{ enabled: false, label: '최근 수집함 없음' }];

  trayMenu = Menu.buildFromTemplate([
      { accelerator: shortcutSettings.toggleMini, click: () => showMiniForMemo(), label: '빠른 메모 작성' },
      {
        accelerator: shortcutSettings.capturePage,
        click: () => void captureCurrentBrowserPage(),
        label: '현재 페이지 저장',
      },
      { type: 'separator' },
      { enabled: false, label: '최근 수집함' },
      ...recentEntries,
      { type: 'separator' },
      {
        click: () => {
          const mainWindow = getMainWindow() ?? createWindow();
          mainWindow.show();
          mainWindow.focus();
        },
        label: 'Open Subnota',
      },
      { accelerator: 'CommandOrControl+,', click: openSettingsWindow, label: '설정' },
      { role: 'quit' },
    ]);
  // NOTE: do NOT call tray.setContextMenu here. On macOS, attaching a context
  // menu makes a LEFT-click (and one-finger tap) open the menu instead of
  // firing the 'click' handler — which made a plain tap pop the menu (with
  // "설정"). We only show the menu on right-click via popUpContextMenu, so
  // left-click stays as "toggle Mini Subnota".
};

const recordInboxSave = (item: RecentInboxItem) => {
  if (!item.url) {
    return;
  }
  const isNewUrl = !recentInboxItems.some((entry) => entry.url === item.url);
  recentInboxItems = [item, ...recentInboxItems.filter((entry) => entry.url !== item.url)].slice(
    0,
    3,
  );
  if (isNewUrl) {
    setUnreadInbox(true);
    pulseUnreadInboxBadge();
  }
  buildTrayMenu();
  updateMiniRecentInbox(recentInboxItems);
  updateMiniStatus(getInboxSaveStatusMessage(item));
};

const installMenuBarItem = () => {
  // nativeImage cannot load .icns/.svg — use the generated PNG. Packaged builds
  // copy it next to the app (extraResource → Resources/).
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tray.png')
    : path.join(app.getAppPath(), 'resources', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    console.error('[Subnota] menu-bar icon failed to load:', iconPath);
    return;
  }

  // Size down to the menu-bar standard, otherwise the tray item renders oversized.
  const menuBarIcon = icon.resize({ height: 18, width: 18 });
  // Template image: macOS tints it to match the menu bar (white on the dark
  // menu bar). Source PNG must be a black/alpha silhouette on a transparent bg.
  menuBarIcon.setTemplateImage(true);
  tray = new Tray(menuBarIcon);
  tray.setToolTip('Subnota');
  buildTrayMenu();
  tray.on('click', () => {
    setUnreadInbox(false);
    toggleMiniWindow();
  });
  tray.on('right-click', () => {
    buildTrayMenu();
    if (trayMenu) {
      tray?.popUpContextMenu(trayMenu);
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  appReady = true;
  installApplicationMenu();
  installMenuBarItem();

  app.setAsDefaultProtocolClient('subnota');
  setupMiniSubnota({
    getAnchorBounds: () => tray?.getBounds() ?? null,
    getRecentInboxItems: () => recentInboxItems,
    preloadPath: path.join(__dirname, 'preload.js'),
    loadRenderer,
    onCapture: (payload) => sendToMainWindow('inbox-capture', payload),
    onCaptureError: (message) => sendToMainWindow('inbox-capture', { error: message }),
    onReveal: () => setUnreadInbox(false),
  });
  applyGlobalShortcutSettings(shortcutSettings);

  configureAutoUpdater({
    isPackaged: app.isPackaged,
    notifyRenderer: (channel, info) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channel, info);
      }
    },
  });

  // Pick up file paths passed as CLI arguments (dev workflow only).
  // The open-file event is not emitted for argv — only for Apple Events from
  // a packaged, OS-registered app.
  const argFilePaths = process.argv.filter((arg) => /\.(md|markdown)$/i.test(arg));
  for (const p of argFilePaths) {
    if (!pendingFilePaths.includes(p)) pendingFilePaths.push(p);
  }

  // Set CSP for the renderer. In dev, Vite HMR requires unsafe-eval and
  // a WebSocket connection back to the dev server. Only inject CSP on the app
  // document/assets served from the dev server — NOT on every response.
  // Applying it to the shared default session also rewrote headers for the
  // Google/Supabase OAuth window, which broke sign-in/2FA (ERR_BLOCKED_BY_CSP
  // on Google's cross-domain connection checks).
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const devOrigin = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (!details.url.startsWith(devOrigin)) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://*.run.app; " +
            "img-src 'self' data: blob:",
          ],
        },
      });
    });
  }

  if (pendingFilePaths.length > 0) {
    for (const p of pendingFilePaths.splice(0)) {
      createWindow(p);
    }
  } else {
    createWindow();
  }

  for (const url of pendingDeepLinks.splice(0)) {
    handleDeepLink(url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
