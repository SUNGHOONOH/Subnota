import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  session,
  shell,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { checkForNativeUpdate, configureAutoUpdater, installNativeUpdate } from './auto-updater';
import { checkForUpdate } from './update-checker';
import { attachCloseHandler } from './window-close-handler';
import { parseSubnotaUrl } from './deep-link';
import {
  MAIN_MIN_SIZE,
  createPreferredMainWindowBounds,
} from './lib/windowBounds';

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

ipcMain.handle('start-oauth', async (_, provider: string) => {
  return new Promise((resolve, reject) => {
    const supabaseUrl = 'https://kwrbbxctutngcoqtccjv.supabase.co';
    const redirectUrl = 'https://subnota-pwa.vercel.app/';
    const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}`;

    const authWindow = new BrowserWindow({
      width: 480,
      height: 640,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    let resolved = false;

    const handleUrlChange = (url: string) => {
      if (url.startsWith(redirectUrl) && url.includes('#')) {
        const hash = url.split('#')[1];
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresIn = params.get('expires_in');

        if (accessToken && refreshToken) {
          resolved = true;
          authWindow.destroy();
          resolve({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: expiresIn,
          });
        }
      }
    };

    authWindow.webContents.on('will-navigate', (_event, url) => {
      handleUrlChange(url);
    });

    authWindow.webContents.on('did-navigate', (_event, url) => {
      handleUrlChange(url);
    });

    authWindow.on('closed', () => {
      if (!resolved) {
        reject(new Error('소셜 로그인이 취소되었습니다.'));
      }
    });

    authWindow.loadURL(authUrl);
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

const handleDeepLink = (raw: string) => {
  const link = parseSubnotaUrl(raw);
  if (!link) {
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
          accelerator: 'CommandOrControl+N',
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
app.on('ready', () => {
  appReady = true;
  installApplicationMenu();

  app.setAsDefaultProtocolClient('subnota');

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
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
