import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  net,
  protocol,
  screen,
  session,
  shell,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { checkForNativeUpdate, configureAutoUpdater, installNativeUpdate } from './auto-updater';
import { checkForUpdate } from './update-checker';
import {
  hideMiniWindow,
  registerGlobalShortcuts,
  setupMiniSubnota,
  toggleMiniWindow,
  unregisterGlobalShortcuts,
} from './mini-subnota';
import {
  DEFAULT_SHORTCUT_SETTINGS,
  ShortcutSettings,
  normalizeShortcutSettings,
} from './lib/shortcutSettings';
import { attachCloseHandler } from './window-close-handler';
import { parseSubnotaUrl } from './deep-link';
import {
  MAIN_MIN_SIZE,
  createPreferredMainWindowBounds,
} from './lib/windowBounds';
import './local-database';

const APP_RENDERER_SCHEME = 'subnota-app';
const APP_RENDERER_ORIGIN = `${APP_RENDERER_SCHEME}://bundle`;
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.run.app",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

const isTrustedRendererUrl = (url: string) =>
  url.startsWith(`${APP_RENDERER_ORIGIN}/`) ||
  (!app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url));

const assertTrustedIpcSender = (event: Electron.IpcMainInvokeEvent) => {
  const senderUrl = event.senderFrame?.url ?? event.sender?.getURL?.() ?? '';
  if (!senderUrl && !app.isPackaged) return;
  if (!isTrustedRendererUrl(senderUrl)) {
    throw new Error('Untrusted IPC sender.');
  }
};

const normalizeMarkdownPath = (filePath: unknown) => {
  if (typeof filePath !== 'string' || !/\.(md|markdown)$/i.test(filePath)) {
    throw new Error('Markdown files only.');
  }
  return typeof path.resolve === 'function' ? path.resolve(filePath) : filePath;
};

protocol?.registerSchemesAsPrivileged([
  {
    scheme: APP_RENDERER_SCHEME,
    privileges: {
      corsEnabled: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const pendingFilePaths: string[] = [];
const pendingDeepLinks: string[] = [];
let appReady = false;
const authWindowBounds = new Map<number, Electron.Rectangle>();
const windowFilePaths = new Map<number, string>();
const mainWindows = new Set<BrowserWindow>();

const AUTH_WINDOW_SIZE = { height: 680, width: 480 };
const DESKTOP_PREFERENCES_FILE = 'desktop-preferences.json';

type DesktopPreferences = {
  closeBehavior: 'quit' | 'tray';
  launchAtLogin: boolean;
};
let currentCloseBehavior: DesktopPreferences['closeBehavior'] = 'tray';
let appIsQuitting = false;

app.on('before-quit', () => {
  appIsQuitting = true;
});

const readDesktopPreferences = (): DesktopPreferences => {
  try {
    const raw = fs.readFileSync(
      path.join(app.getPath('userData'), DESKTOP_PREFERENCES_FILE),
      'utf8',
    );
    const value = JSON.parse(raw) as Partial<DesktopPreferences>;
    return {
      closeBehavior: value.closeBehavior === 'quit' ? 'quit' : 'tray',
      launchAtLogin: value.launchAtLogin === true,
    };
  } catch {
    return { closeBehavior: 'tray', launchAtLogin: false };
  }
};

const saveDesktopPreferences = (preferences: DesktopPreferences) => {
  fs.writeFileSync(
    path.join(app.getPath('userData'), DESKTOP_PREFERENCES_FILE),
    JSON.stringify(preferences, null, 2),
    'utf8',
  );
};

ipcMain.handle('desktop-preferences:get', event => {
  assertTrustedIpcSender(event);
  const stored = readDesktopPreferences();
  return {
    closeBehavior: currentCloseBehavior,
    launchAtLogin:
      app.getLoginItemSettings?.().openAtLogin || stored.launchAtLogin,
  };
});

ipcMain.handle(
  'desktop-preferences:set',
  (event, preferences: DesktopPreferences) => {
    assertTrustedIpcSender(event);
    const normalized: DesktopPreferences = {
      closeBehavior: preferences.closeBehavior === 'quit' ? 'quit' : 'tray',
      launchAtLogin: preferences.launchAtLogin === true,
    };
    currentCloseBehavior = normalized.closeBehavior;
    app.setLoginItemSettings?.({ openAtLogin: normalized.launchAtLogin });
    saveDesktopPreferences(normalized);
    return normalized;
  },
);

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
        setImmediate(() => void shell.openExternal(parsedUrl.toString()));
      }
    } catch {
      // Invalid and non-web URLs stay blocked.
    }
    return { action: 'deny' };
  });
});

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

// macOS delivers subnota:// deep links via open-url; Windows receives them via
// argv/second-instance, but keeping this handler is harmless and preserves parity.
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (appReady) {
    handleDeepLink(url);
  } else {
    pendingDeepLinks.push(url);
  }
});

type OAuthCallback = { code: string | null; error: string | null };

let pendingOAuthCallback: OAuthCallback | null = null;
let activeOAuth:
  | {
      reject: (error: Error) => void;
      resolve: (code: string) => void;
      timer: NodeJS.Timeout;
    }
  | null = null;

const finishActiveOAuth = (callback: OAuthCallback) => {
  if (!activeOAuth) {
    pendingOAuthCallback = callback;
    return;
  }

  const current = activeOAuth;
  activeOAuth = null;
  clearTimeout(current.timer);

  if (callback.error) {
    current.reject(new Error(callback.error));
  } else if (callback.code) {
    current.resolve(callback.code);
  } else {
    current.reject(new Error('로그인 응답에서 코드를 찾지 못했습니다.'));
  }
};

ipcMain.handle('cancel-oauth', event => {
  assertTrustedIpcSender(event);
  if (!activeOAuth) return;
  const current = activeOAuth;
  activeOAuth = null;
  clearTimeout(current.timer);
  current.reject(new Error('소셜 로그인이 취소되었습니다.'));
});

ipcMain.handle('consume-oauth-callback', event => {
  assertTrustedIpcSender(event);
  const callback = pendingOAuthCallback;
  pendingOAuthCallback = null;
  return callback;
});

ipcMain.handle('start-oauth', async (event, authUrl: string) => {
  assertTrustedIpcSender(event);
  let parsedAuthUrl: URL;
  try {
    parsedAuthUrl = new URL(authUrl);
  } catch {
    throw new Error('올바르지 않은 OAuth 로그인 URL입니다.');
  }
  const isLocalDevelopmentUrl =
    !app.isPackaged &&
    parsedAuthUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(parsedAuthUrl.hostname);
  if (
    (parsedAuthUrl.protocol !== 'https:' && !isLocalDevelopmentUrl) ||
    !parsedAuthUrl.pathname.endsWith('/auth/v1/authorize')
  ) {
    throw new Error('허용되지 않은 OAuth 로그인 URL입니다.');
  }

  if (activeOAuth) {
    const current = activeOAuth;
    activeOAuth = null;
    clearTimeout(current.timer);
    current.reject(new Error('새 소셜 로그인이 시작되었습니다.'));
  }

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        activeOAuth = null;
        reject(new Error('소셜 로그인이 취소되었습니다.'));
      },
      5 * 60 * 1000,
    );
    activeOAuth = { reject, resolve, timer };

    void shell.openExternal(authUrl).catch(error => {
      if (activeOAuth?.timer === timer) {
        activeOAuth = null;
        clearTimeout(timer);
        reject(
          error instanceof Error
            ? error
            : new Error('기본 브라우저를 열지 못했습니다.'),
        );
      }
    });
  });
});

ipcMain.handle('read-file', async (event, filePath: string) => {
  assertTrustedIpcSender(event);
  const normalizedPath = normalizeMarkdownPath(filePath);
  const stat = await fs.promises.stat(normalizedPath);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error('File is too large.');
  const content = await fs.promises.readFile(normalizedPath, 'utf-8');
  windowFilePaths.set(event.sender.id, normalizedPath);
  return { path: normalizedPath, content };
});

ipcMain.handle('save-file', async (event, filePath: string, content: string) => {
  assertTrustedIpcSender(event);
  const normalizedPath = normalizeMarkdownPath(filePath);
  if (windowFilePaths.get(event.sender.id) !== normalizedPath) {
    throw new Error('File path is not authorized for this window.');
  }
  if (typeof content !== 'string' || content.length > 10 * 1024 * 1024) {
    throw new Error('File content is too large.');
  }
  await fs.promises.writeFile(normalizedPath, content, 'utf-8');
});

ipcMain.handle('check-for-update', event => {
  assertTrustedIpcSender(event);
  if (checkForNativeUpdate()) return null;
  return checkForUpdate();
});

ipcMain.handle('install-update', event => {
  assertTrustedIpcSender(event);
  return installNativeUpdate();
});

ipcMain.handle('open-external', async (event, url: string) => {
  assertTrustedIpcSender(event);
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

ipcMain.handle('open-local-file', (event, filePath: string) => {
  assertTrustedIpcSender(event);
  if (!/\.(md|markdown)$/i.test(filePath)) return false;
  if (!fs.existsSync(filePath)) return false;
  createWindow(filePath);
  return true;
});

ipcMain.handle('set-file-path', (event, filePath: string) => {
  assertTrustedIpcSender(event);
  const normalizedPath = normalizeMarkdownPath(filePath);
  if (typeof fs.existsSync === 'function' && !fs.existsSync(normalizedPath)) {
    throw new Error('File does not exist.');
  }
  windowFilePaths.set(event.sender.id, normalizedPath);
});

ipcMain.handle('set-auth-window-mode', (event, isAuthMode: boolean) => {
  assertTrustedIpcSender(event);
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

const loadRenderer = (window: BrowserWindow, hash?: string) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = hash
      ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#${hash}`
      : MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const load = () => window.loadURL(url);
    // Retry on ERR_CONNECTION_REFUSED (-102): happens when Vite is still
    // re-optimizing deps on first run after installing packages.
    window.webContents.on('did-fail-load', (_, errorCode) => {
      if (errorCode === -102) setTimeout(load, 1000);
    });
    load();
  } else {
    const url = `${APP_RENDERER_ORIGIN}/index.html${hash ? `#${hash}` : ''}`;
    window.loadURL(url);
  }
};

const registerRendererProtocol = () => {
  if (!protocol?.handle) {
    return;
  }
  const rendererRoot = path.join(
    __dirname,
    `../renderer/${MAIN_WINDOW_VITE_NAME}`,
  );
  void protocol.handle(APP_RENDERER_SCHEME, async request => {
    const requestUrl = new URL(request.url);
    if (requestUrl.host !== 'bundle') {
      return new Response('Not found', { status: 404 });
    }
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(rendererRoot, relativePath);
    const relative = path.relative(rendererRoot, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('Bad request', { status: 400 });
    }
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  });
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

  attachCloseHandler(mainWindow, {
    shouldHideOnClose: () =>
      !appIsQuitting && currentCloseBehavior === 'tray',
  });
  mainWindows.add(mainWindow);
  mainWindow.on('closed', () => {
    mainWindows.delete(mainWindow);
  });

  if (filePath) {
    try {
      windowFilePaths.set(mainWindow.webContents.id, normalizeMarkdownPath(filePath));
    } catch {
      // Ignore files outside the registered Markdown document types.
    }
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

const handleDeepLink = (raw: string) => {
  const link = parseSubnotaUrl(raw);
  if (!link) {
    return;
  }
  if (link.kind === 'auth') {
    finishActiveOAuth({ code: link.code, error: link.error });
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }
  if (link.kind === 'memo') {
    return;
  }
  sendToMainWindow('inbox-capture', { title: link.title, url: link.url });
};

const installApplicationMenu = () => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Subnota',
      submenu: [
        { role: 'about' },
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
          click: () => sendToMainWindow('new-memo'),
          label: 'New Memo',
        },
        {
          click: () => createWindow(),
          label: 'New Window',
        },
        { type: 'separator' },
        {
          accelerator: 'CommandOrControl+,',
          click: openSettingsWindow,
          label: 'Settings...',
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// --- Mini Subnota (system tray) ---
let tray: Tray | null = null;
let shortcutSettings = DEFAULT_SHORTCUT_SETTINGS;

ipcMain.on('mini-close', () => {
  hideMiniWindow();
});

ipcMain.on('mini-saved', () => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('memos-updated');
  }
});

ipcMain.on('open-main-window', () => {
  const mainWindow = getMainWindow() ?? createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

const applyGlobalShortcutSettings = (next: ShortcutSettings) => {
  unregisterGlobalShortcuts();
  // Web capture is deferred to a future Chrome extension on Windows, so the
  // capture shortcut is registered to a no-op; only the mini toggle is live.
  return registerGlobalShortcuts(
    { onToggleMemo: () => toggleMiniWindow(), onCapture: () => undefined },
    next,
  );
};

ipcMain.handle(
  'set-global-shortcuts',
  (event, next: Partial<ShortcutSettings>) => {
    assertTrustedIpcSender(event);
    const normalized = normalizeShortcutSettings(next);
    const registered = applyGlobalShortcutSettings(normalized);
    if (!registered.capture || !registered.toggle) {
      applyGlobalShortcutSettings(shortcutSettings);
      return { registered, settings: shortcutSettings };
    }
    shortcutSettings = normalized;
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('shortcut-settings-changed', shortcutSettings);
      }
    }
    return { registered, settings: shortcutSettings };
  },
);

const setupTray = () => {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(app.getAppPath(), 'resources', 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? iconPath : icon);
  tray.setToolTip('Subnota');
  tray.on('click', () => toggleMiniWindow());
};

app.on('ready', () => {
  appReady = true;
  const desktopPreferences = readDesktopPreferences();
  currentCloseBehavior = desktopPreferences.closeBehavior;
  app.setLoginItemSettings?.({ openAtLogin: desktopPreferences.launchAtLogin });
  registerRendererProtocol();
  // The renderer loads only bundled content and needs no device permissions
  // (camera, mic, geolocation, notifications, etc.). Without a handler Electron
  // auto-approves permission requests, which a renderer compromise could abuse.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  installApplicationMenu();

  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('subnota', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient('subnota');
  }

  setupTray();
  setupMiniSubnota({
    getAnchorBounds: () => tray?.getBounds() ?? null,
    getRecentInboxItems: () => [],
    preloadPath: path.join(__dirname, 'preload.js'),
    loadRenderer,
    onCapture: () => undefined,
    onCaptureError: () => undefined,
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

  // Pick up file paths and custom protocol URLs passed as CLI arguments.
  const argFilePaths = process.argv.filter((arg) => /\.(md|markdown)$/i.test(arg));
  for (const p of argFilePaths) {
    if (!pendingFilePaths.includes(p)) pendingFilePaths.push(p);
  }
  for (const url of collectDeepLinksFromArgv(process.argv)) {
    if (!pendingDeepLinks.includes(url)) pendingDeepLinks.push(url);
  }

  // Set CSP for the renderer. In dev, Vite HMR requires unsafe-eval and
  // a WebSocket connection back to the dev server.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://*.run.app; " +
            // https: matches the packaged-app CSP — inbox thumbnails and
            // domain favicons are remote images.
            "img-src 'self' data: blob: https:",
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
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
