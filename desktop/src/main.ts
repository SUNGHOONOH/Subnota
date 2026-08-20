import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  Menu,
  Notification,
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
import { attachCloseHandler } from './window-close-handler';
import { parseSubnotaUrl } from './deep-link';
import {
  captureCurrentBrowserPage,
  hideMiniWindow,
  isMiniSubnotaWebContents,
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
import { COLD_START_ARG, DESKTOP_PLATFORM_FEATURES } from './platform/policy';
import {
  normalizeExternalUrl,
  normalizeOAuthAuthorizeUrl,
  normalizeWebUrl,
} from './lib/url-policy';
import {
  configureLocalDatabaseMaintenanceHooks,
  flushLocalDatabaseOperations,
} from './local-database';
// local-embed:* IPC 핸들러는 이 모듈의 최상위 부수효과로 등록된다.
import './local-embedding';

const APP_RENDERER_SCHEME = 'subnota-app';
const APP_RENDERER_ORIGIN = `${APP_RENDERER_SCHEME}://bundle`;
const POSTHOG_API_ORIGIN = 'https://us.i.posthog.com';
const POSTHOG_ASSETS_ORIGIN = 'https://us-assets.i.posthog.com';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${POSTHOG_ASSETS_ORIGIN}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.run.app ${POSTHOG_API_ORIGIN} ${POSTHOG_ASSETS_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

const isTrustedRendererUrl = (url: string) =>
  url.startsWith(`${APP_RENDERER_ORIGIN}/`) ||
  (!app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url));

type TrustedIpcEvent = Electron.IpcMainEvent | Electron.IpcMainInvokeEvent;

const isTrustedIpcSender = (event: TrustedIpcEvent) => {
  const senderUrl = event.senderFrame?.url ?? event.sender?.getURL?.() ?? '';
  return (!senderUrl && !app.isPackaged) || isTrustedRendererUrl(senderUrl);
};

const assertTrustedIpcSender = (event: TrustedIpcEvent) => {
  if (!isTrustedIpcSender(event)) {
    throw new Error('Untrusted IPC sender.');
  }
};

const isTrustedMiniIpcSender = (event: Electron.IpcMainEvent) =>
  isTrustedIpcSender(event) && isMiniSubnotaWebContents(event.sender.id);

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

// No-op on macOS; only handles installer startup events on Windows builds.
if (started) {
  app.quit();
}

const pendingDeepLinks: string[] = [];
let appReady = false;
let tray: Tray | null = null;
let trayMenu: Menu | null = null;
let shortcutSettings = DEFAULT_SHORTCUT_SETTINGS;
type UiLanguage = 'en' | 'ko';
let currentUiLanguage: UiLanguage = 'ko';
const authWindowBounds = new Map<number, Electron.Rectangle>();
const mainWindows = new Set<BrowserWindow>();
let activeWorkspaceOwner: string | null = null;

const isMainWindowSender = (event: Electron.IpcMainInvokeEvent) =>
  [...mainWindows].some(
    window => !window.isDestroyed() && window.webContents.id === event.sender.id,
  );

const mainT = (korean: string, english: string) =>
  currentUiLanguage === 'en' ? english : korean;

ipcMain.handle('app:set-ui-language', (event, language: unknown) => {
  assertTrustedIpcSender(event);
  if (!isMainWindowSender(event)) throw new Error('Only a main window can set the UI language.');
  if (language !== 'en' && language !== 'ko') throw new Error('Invalid UI language.');
  currentUiLanguage = language;
  installApplicationMenu();
  buildTrayMenu();
});

ipcMain.handle('active-workspace-owner:set', (event, ownerId: unknown) => {
  assertTrustedIpcSender(event);
  if (!isMainWindowSender(event)) throw new Error('Only a main window can set the owner.');
  if (
    ownerId !== null &&
    (typeof ownerId !== 'string' || ownerId.length < 1 || ownerId.length > 128)
  ) {
    throw new Error('Invalid workspace owner.');
  }
  activeWorkspaceOwner = ownerId as string | null;
});

ipcMain.handle('active-workspace-owner:get', event => {
  assertTrustedIpcSender(event);
  return activeWorkspaceOwner;
});

const AUTH_WINDOW_SIZE = { height: 720, width: 1000 };
// Electron's macOS bridge only applies a maximum when it receives a positive
// value. Use the same practical "unbounded" value Electron uses internally
// instead of 0, which can leave NSWindow's previous auth-size maximum behind.
const UNBOUNDED_WINDOW_SIZE = 2_147_483_647;
const DESKTOP_PREFERENCES_FILE = 'desktop-preferences.json';

type DesktopPreferences = {
  closeBehavior: 'quit' | 'tray';
  launchAtLogin: boolean;
};
let currentCloseBehavior: DesktopPreferences['closeBehavior'] = 'tray';
let appIsQuitting = false;
let allowQuitAfterFlush = false;
let quitFlushInProgress = false;
let localWriteFlushFailureDialogInProgress = false;
let nativeUpdateInstallInProgress = false;
let localWriteFlushRequestId = 0;
const LOCAL_WRITE_FLUSH_TIMEOUT_MS = 15_000;
let localWriteLifecycleCount = 0;
let localWriteLifecycleTail: Promise<void> = Promise.resolve();
let sharedAllWindowFlush: Promise<boolean> | null = null;
const deferredMainWindowRendererLoads = new Set<BrowserWindow>();
const pendingLocalWriteFlushes = new Map<
  string,
  { finish: (ok: boolean) => void; targetId: number }
>();

const requestLocalWriteFlush = (
  window: BrowserWindow,
  reason: LocalWriteFlushReason,
) => {
  const contents = window.webContents;
  if (
    window.isDestroyed() ||
    contents.isDestroyed?.() ||
    deferredMainWindowRendererLoads.has(window) ||
    contents.isLoading?.()
  ) {
    return Promise.resolve(true);
  }

  const requestId = `flush-${Date.now().toString(36)}-${(
    ++localWriteFlushRequestId
  ).toString(36)}`;
  return new Promise<boolean>(resolve => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (ok: boolean) => {
      const pending = pendingLocalWriteFlushes.get(requestId);
      if (!pending) return;
      pendingLocalWriteFlushes.delete(requestId);
      if (timer) clearTimeout(timer);
      resolve(ok);
    };
    pendingLocalWriteFlushes.set(requestId, {
      finish,
      targetId: contents.id,
    });
    timer = setTimeout(() => finish(false), LOCAL_WRITE_FLUSH_TIMEOUT_MS);
    try {
      contents.send('flush-pending-local-writes', { reason, requestId });
    } catch {
      finish(false);
    }
  });
};

const resumeDeferredMainWindowRendererLoads = () => {
  setImmediate(() => {
    if (localWriteLifecycleCount > 0 || appIsQuitting) return;
    for (const window of [...deferredMainWindowRendererLoads]) {
      deferredMainWindowRendererLoads.delete(window);
      if (!window.isDestroyed()) loadRenderer(window);
    }
  });
};

const enqueueLocalWriteLifecycle = <T>(task: () => Promise<T>) => {
  localWriteLifecycleCount += 1;
  const result = localWriteLifecycleTail.then(task, task);
  localWriteLifecycleTail = result.then(
    () => undefined,
    () => undefined,
  );
  const settled = () => {
    localWriteLifecycleCount -= 1;
    if (localWriteLifecycleCount === 0) {
      resumeDeferredMainWindowRendererLoads();
    }
  };
  void result.then(settled, settled);
  return result;
};

const requestAllRendererWriteFlushes = async (
  reason: LocalWriteFlushReason,
  flushedWindowIds = new Set<number>(),
): Promise<boolean> => {
  const targets = [...mainWindows].filter(
    window =>
      !window.isDestroyed() &&
      !deferredMainWindowRendererLoads.has(window) &&
      !flushedWindowIds.has(window.id),
  );
  if (targets.length === 0) return true;
  const results = await Promise.all(
    targets.map(window => requestLocalWriteFlush(window, reason)),
  );
  if (!results.every(Boolean)) return false;
  for (const window of targets) flushedWindowIds.add(window.id);
  // Re-snapshot after every acknowledgement round. Windows created while a
  // round is in flight keep their renderer unloaded until this lifecycle
  // finishes, so they cannot start writes behind the final database fence.
  return requestAllRendererWriteFlushes(reason, flushedWindowIds);
};

const flushAllLocalWrites = (
  reason: Extract<LocalWriteFlushReason, 'shutdown' | 'window-close'> =
    'shutdown',
) => {
  if (sharedAllWindowFlush) return sharedAllWindowFlush;
  const flush = enqueueLocalWriteLifecycle(async () => {
    if (!(await requestAllRendererWriteFlushes(reason))) return false;
    try {
      await flushLocalDatabaseOperations();
      return true;
    } catch {
      return false;
    }
  });
  sharedAllWindowFlush = flush;
  const clearSharedFlush = () => {
    if (sharedAllWindowFlush === flush) sharedAllWindowFlush = null;
  };
  void flush.then(clearSharedFlush, clearSharedFlush);
  return flush;
};

const flushWindowLocalWrites = (
  window: BrowserWindow,
  onFlushed: () => void,
) => {
  const flushAndFinish = async () => {
    if (!(await requestLocalWriteFlush(window, 'window-close'))) return false;
    onFlushed();
    return true;
  };
  if (!sharedAllWindowFlush) {
    return enqueueLocalWriteLifecycle(flushAndFinish);
  }
  return sharedAllWindowFlush.then(ok =>
    ok
      ? enqueueLocalWriteLifecycle(async () => {
          onFlushed();
          return true;
        })
      : false,
  );
};

const releaseCancelledLocalWriteGuards = (
  windows: Iterable<BrowserWindow> = mainWindows,
) => {
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send('local-write-flush-cancelled');
    }
  }
  resumeDeferredMainWindowRendererLoads();
};

configureLocalDatabaseMaintenanceHooks({
  acquireRendererWriteGuard: () =>
    new Promise(resolve => {
      let finishLifecycle: () => void = () => undefined;
      const lifecycleHeld = new Promise<void>(finish => {
        finishLifecycle = finish;
      });
      void enqueueLocalWriteLifecycle(async () => {
        const ok = await requestAllRendererWriteFlushes(
          'database-maintenance',
        );
        if (!ok) {
          releaseCancelledLocalWriteGuards();
          resolve(null);
          return;
        }
        let released = false;
        resolve({
          release: (cancelled: boolean) => {
            if (released) return;
            released = true;
            if (cancelled) releaseCancelledLocalWriteGuards();
            finishLifecycle();
          },
        });
        await lifecycleHeld;
      }).catch(() => {
        releaseCancelledLocalWriteGuards();
        resolve(null);
        finishLifecycle();
      });
    }),
});

const showLocalWriteFlushFailure = async () => {
  if (localWriteFlushFailureDialogInProgress) return;
  localWriteFlushFailureDialogInProgress = true;
  const options: Electron.MessageBoxOptions = {
    buttons: [
      mainT('계속 열기', 'Keep app open'),
      mainT('저장 확인 없이 종료', 'Quit without confirming saved changes'),
    ],
    cancelId: 0,
    defaultId: 0,
    message: mainT(
      '최근 변경 사항이 로컬에 저장됐는지 확인하지 못했습니다.',
      'The app could not confirm that recent changes were saved locally.',
    ),
    detail: mainT(
      '계속 열어 두고 다시 종료하면 저장을 다시 확인합니다. 지금 종료하면 마지막 변경 사항 일부가 손실될 수 있습니다.',
      'Keep the app open and try quitting again to check saving again. Quitting now may lose some of your latest changes.',
    ),
    title: mainT(
      '저장 상태를 확인할 수 없습니다',
      'Could not confirm saved changes',
    ),
    type: 'warning',
  };
  const owner = [...mainWindows].find(window => !window.isDestroyed());
  try {
    const result = owner
      ? await dialog.showMessageBox(owner, options)
      : await dialog.showMessageBox(options);
    if (result.response !== 1) return;

    allowQuitAfterFlush = true;
    appIsQuitting = true;
    app.exit(0);
  } finally {
    localWriteFlushFailureDialogInProgress = false;
  }
};

ipcMain.on('flush-pending-local-writes-complete', (event, payload: unknown) => {
  if (!isTrustedIpcSender(event) || !payload || typeof payload !== 'object') {
    return;
  }
  const { ok, requestId } = payload as { ok?: unknown; requestId?: unknown };
  if (
    typeof requestId !== 'string' ||
    !/^flush-[a-z0-9]+-[a-z0-9]+$/.test(requestId) ||
    typeof ok !== 'boolean'
  ) {
    return;
  }
  const pending = pendingLocalWriteFlushes.get(requestId);
  if (!pending || pending.targetId !== event.sender.id) return;
  pending.finish(ok);
});

app.on('before-quit', event => {
  if (allowQuitAfterFlush || mainWindows.size === 0) {
    appIsQuitting = true;
    return;
  }
  event.preventDefault();
  if (localWriteFlushFailureDialogInProgress) return;
  if (quitFlushInProgress) return;
  quitFlushInProgress = true;
  void flushAllLocalWrites().then(ok => {
    quitFlushInProgress = false;
    if (!ok) {
      releaseCancelledLocalWriteGuards();
      showLocalWriteFlushFailure();
      return;
    }
    allowQuitAfterFlush = true;
    appIsQuitting = true;
    app.quit();
  });
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

ipcMain.handle('clipboard:write-text', (event, text: unknown) => {
  assertTrustedIpcSender(event);
  if (typeof text !== 'string') {
    throw new Error('Invalid clipboard text.');
  }
  clipboard.writeText(text);
  return true;
});

const getClipNotificationTitle = (kind: 'failed' | 'saved') =>
  kind === 'failed'
    ? mainT('저장하지 못했어요', 'Could not save')
    : mainT('수집함에 저장했어요', 'Saved to Inbox');
const activeClipNotifications = new Map<string, Notification>();

ipcMain.handle('clip-notification:show', (event, payload: unknown) => {
  assertTrustedIpcSender(event);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid clip notification.');
  }
  const { body, id, kind } = payload as {
    body?: unknown;
    id?: unknown;
    kind?: unknown;
  };
  if (
    typeof id !== 'string' ||
    !/^[a-z0-9-]{1,64}$/i.test(id) ||
    (kind !== 'failed' && kind !== 'saved') ||
    typeof body !== 'string' ||
    body.length === 0 ||
    body.length > 1_000
  ) {
    throw new Error('Invalid clip notification.');
  }
  // 알림이 뜨든 안 뜨든 메뉴바 표시는 갱신한다. 알림을 꺼 둔 사용자에게
  // 이게 유일하게 남는 경로다.
  endCaptureIndicator(kind === 'failed' ? body : undefined);

  if (!Notification.isSupported()) return false;

  const key = `${event.sender.id}:${id}`;
  if (activeClipNotifications.has(key)) return false;
  const notification = new Notification({
    body,
    title: getClipNotificationTitle(kind),
  });
  const finish = (action: 'click' | 'closed') => {
    if (activeClipNotifications.get(key) !== notification) return;
    activeClipNotifications.delete(key);
    if (!event.sender.isDestroyed()) {
      event.sender.send('clip-notification:event', { action, id });
    }
  };
  notification.once('click', () => {
    finish('click');
    notification.close();
  });
  notification.once('close', () => finish('closed'));
  notification.once('failed', () => finish('closed'));
  activeClipNotifications.set(key, notification);
  try {
    notification.show();
    return true;
  } catch (error) {
    activeClipNotifications.delete(key);
    throw error;
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    const normalizedUrl = normalizeWebUrl(url);
    if (normalizedUrl) {
      setImmediate(() => void shell.openExternal(normalizedUrl));
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

// macOS delivers subnota:// deep links via open-url; queue them until ready.
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
    current.reject(
      new Error(mainT('로그인 응답에서 코드를 찾지 못했습니다.', 'Could not find a code in the sign-in response.')),
    );
  }
};

ipcMain.handle('cancel-oauth', event => {
  assertTrustedIpcSender(event);
  if (!activeOAuth) return;
  const current = activeOAuth;
  activeOAuth = null;
  clearTimeout(current.timer);
  current.reject(new Error(mainT('소셜 로그인이 취소되었습니다.', 'Social sign-in was cancelled.')));
});

ipcMain.handle('consume-oauth-callback', event => {
  assertTrustedIpcSender(event);
  const callback = pendingOAuthCallback;
  pendingOAuthCallback = null;
  return callback;
});

ipcMain.handle('start-oauth', async (event, authUrl: string) => {
  assertTrustedIpcSender(event);
  const normalizedAuthUrl = normalizeOAuthAuthorizeUrl(
    authUrl,
    import.meta.env.VITE_SUPABASE_URL,
    { allowLocalHttp: !app.isPackaged },
  );
  if (!normalizedAuthUrl) {
    throw new Error(mainT('허용되지 않은 OAuth 로그인 URL입니다.', 'The OAuth sign-in URL is not allowed.'));
  }

  if (activeOAuth) {
    const current = activeOAuth;
    activeOAuth = null;
    clearTimeout(current.timer);
    current.reject(new Error(mainT('새 소셜 로그인이 시작되었습니다.', 'A new social sign-in has started.')));
  }

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        activeOAuth = null;
        reject(new Error(mainT('소셜 로그인이 취소되었습니다.', 'Social sign-in was cancelled.')));
      },
      5 * 60 * 1000,
    );
    activeOAuth = { reject, resolve, timer };

    void shell.openExternal(normalizedAuthUrl).catch(error => {
      if (activeOAuth?.timer === timer) {
        activeOAuth = null;
        clearTimeout(timer);
        reject(
          error instanceof Error
            ? error
            : new Error(mainT('기본 브라우저를 열지 못했습니다.', 'Could not open the default browser.')),
        );
      }
    });
  });
});

ipcMain.handle('check-for-update', event => {
  assertTrustedIpcSender(event);
  return checkForUpdate();
});

ipcMain.handle('download-update', event => {
  assertTrustedIpcSender(event);
  return checkForNativeUpdate();
});

ipcMain.handle('install-update', async event => {
  assertTrustedIpcSender(event);
  if (!(await flushAllLocalWrites())) {
    releaseCancelledLocalWriteGuards();
    throw new Error('작업 내용을 저장하지 못해 업데이트를 중단했습니다.');
  }
  // quitAndInstall closes windows before Electron emits before-quit. Mark this
  // first so the tray preference never turns an update restart into a hide.
  nativeUpdateInstallInProgress = true;
  allowQuitAfterFlush = true;
  appIsQuitting = true;
  try {
    installNativeUpdate();
  } catch (error) {
    nativeUpdateInstallInProgress = false;
    allowQuitAfterFlush = false;
    appIsQuitting = false;
    releaseCancelledLocalWriteGuards();
    throw error;
  }
});

ipcMain.handle('open-external', async (event, url: string) => {
  assertTrustedIpcSender(event);
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return false;
  await shell.openExternal(normalizedUrl);
  return true;
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

  window.setMaximumSize(UNBOUNDED_WINDOW_SIZE, UNBOUNDED_WINDOW_SIZE);
  window.setMinimumSize(MAIN_MIN_SIZE.width, MAIN_MIN_SIZE.height);
  const previousBounds = authWindowBounds.get(window.id);
  if (previousBounds) {
    window.setBounds(previousBounds, true);
    authWindowBounds.delete(window.id);
  }
  return true;
});

ipcMain.on('mini-close', event => {
  if (!isTrustedMiniIpcSender(event)) return;
  hideMiniWindow();
});

ipcMain.on('mini-saved', event => {
  if (!isTrustedMiniIpcSender(event)) return;
  broadcastToMainWindows('memos-updated');
});

// Mini의 "현재 페이지 저장" 버튼. 전역 단축키와 같은 동작이지만 Mini가 최전면일
// 수 있어, 직전에 기억해 둔 브라우저를 대비책으로 쓰도록 허용한다.
ipcMain.on('mini-capture-page', event => {
  if (!isTrustedMiniIpcSender(event)) return;
  if (!DESKTOP_PLATFORM_FEATURES.captureShortcut) return;
  void captureCurrentBrowserPage({ allowRememberedApp: true });
});

ipcMain.on('open-main-window', event => {
  if (!isTrustedMiniIpcSender(event)) return;
  const mainWindow = getMainWindow() ?? createWindow();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('open-settings-window', event => {
  if (!isTrustedMiniIpcSender(event)) return;
  openSettingsWindow();
});

ipcMain.on('record-inbox-save', (event, item: unknown) => {
  if (!isTrustedIpcSender(event)) return;
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
  const registered = registerGlobalShortcuts(shortcutHandlers, nextSettings, {
    capture: DESKTOP_PLATFORM_FEATURES.captureShortcut,
  });

  return {
    registered,
    settings: nextSettings,
  };
};

// 단축키 녹화 중에는 OS 등록을 잠시 내린다. globalShortcut은 창보다 먼저
// 키를 가로채므로, 켜 둔 채로는 렌더러가 keydown을 받지 못하고 Mini 창이
// 대신 뜬다.
ipcMain.handle('suspend-global-shortcuts', (event, suspended: boolean) => {
  assertTrustedIpcSender(event);
  if (suspended) {
    unregisterGlobalShortcuts();
    return;
  }
  applyGlobalShortcutSettings(shortcutSettings);
});

ipcMain.handle(
  'set-global-shortcuts',
  (event, nextSettings: Partial<ShortcutSettings>) => {
    assertTrustedIpcSender(event);
    const normalized = normalizeShortcutSettings(nextSettings);
    const result = applyGlobalShortcutSettings(normalized);

    if (!result.registered.capture || !result.registered.toggle) {
      // 이전 설정으로 되돌리되, registered는 실패한 쪽을 그대로 돌려준다.
      // 롤백 등록의 결과(전부 true)를 반환하면 호출자가 실패를 성공으로 읽는다.
      applyGlobalShortcutSettings(shortcutSettings);
      return { registered: result.registered, settings: shortcutSettings };
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

/**
 * 앱을 켠 뒤 처음 만드는 창인가.
 *
 * 브랜드 조립 모션은 "앱을 껐다 켰다"에만 어울린다. 창만 닫았다 다시 여는
 * 것은 프로세스가 계속 살아 있던 것이라 사용자에겐 재시작이 아니다.
 * 렌더러의 navigation type으로는 이 둘이 똑같이 'navigate'라 구분되지 않아,
 * 창을 만드는 쪽에서 알려 준다.
 */
let hasCreatedMainWindow = false;

// `show: false`는 백그라운드 저장(웹 클리핑)에서만 쓴다. 렌더러는 살려야
// 하지만 사용자는 브라우저에 머물러 있어야 하는 경우다.
const createWindow = ({ show = true }: { show?: boolean } = {}) => {
  const bounds = createPreferredMainWindowBounds(getPrimaryWorkArea());
  const isColdStart = !hasCreatedMainWindow;
  hasCreatedMainWindow = true;

  const mainWindow = new BrowserWindow({
    ...bounds,
    minHeight: MAIN_MIN_SIZE.height,
    minWidth: MAIN_MIN_SIZE.width,
    show,
    title: 'Subnota',
    ...(DESKTOP_PLATFORM_FEATURES.platform === 'macos'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // IPC 왕복 대신 인자로 넘긴다. 부팅 화면은 가장 먼저 그려져야 하는데
      // 첫 프레임을 위해 메인 프로세스 응답을 기다리게 만들 이유가 없다.
      ...(isColdStart ? { additionalArguments: [COLD_START_ARG] } : {}),
    },
  });

  attachCloseHandler(mainWindow, {
    shouldHideOnClose: () =>
      !appIsQuitting && currentCloseBehavior === 'tray',
  });
  let allowCloseAfterFlush = false;
  let closeFlushInProgress = false;
  mainWindow.on('close', event => {
    if (appIsQuitting || allowCloseAfterFlush) {
      return;
    }
    // The earlier tray close handler prevents destruction and hides the window.
    // Only a close that will actually destroy this renderer needs a flush.
    if (currentCloseBehavior !== 'quit') return;
    event.preventDefault();
    if (localWriteFlushFailureDialogInProgress) return;
    if (closeFlushInProgress) return;
    closeFlushInProgress = true;
    const isLastMainWindow = mainWindows.size === 1;
    const flush = isLastMainWindow
      ? flushAllLocalWrites('window-close')
      : flushWindowLocalWrites(mainWindow, () => {
          if (mainWindow.isDestroyed()) return;
          allowCloseAfterFlush = true;
          mainWindow.close();
        });
    void flush.then(ok => {
      closeFlushInProgress = false;
      if (!ok) {
        releaseCancelledLocalWriteGuards(
          isLastMainWindow ? mainWindows : [mainWindow],
        );
        showLocalWriteFlushFailure();
        return;
      }
      if (isLastMainWindow) {
        allowQuitAfterFlush = true;
        appIsQuitting = true;
        app.quit();
      }
    });
  });
  mainWindows.add(mainWindow);
  mainWindow.on('closed', () => {
    deferredMainWindowRendererLoads.delete(mainWindow);
    mainWindows.delete(mainWindow);
  });

  if (localWriteLifecycleCount > 0) {
    deferredMainWindowRendererLoads.add(mainWindow);
  } else {
    loadRenderer(mainWindow);
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  return mainWindow;
};

const getMainWindow = () => {
  return Array.from(mainWindows).find(window => !window.isDestroyed()) ?? null;
};

const whenRendererReady = (window: BrowserWindow, send: () => void) => {
  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', send);
  } else {
    send();
  }
};

/**
 * 사용자가 "Subnota를 열어 달라"고 한 동작에만 쓴다 — 설정 열기, 앱 메뉴의
 * 새 메모처럼. 창이 없으면 만들고 앞으로 가져온다.
 *
 * 웹 클리핑·빠른 메모는 이걸 쓰면 안 된다. `deliverToMainWindow`를 쓸 것.
 */
const sendToMainWindow = (channel: string, payload?: unknown) => {
  const mainWindow = getMainWindow() ?? createWindow();

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();

  whenRendererReady(mainWindow, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  });
};

/**
 * 사용자가 브라우저에 머물러 있길 원하는 전달. 창을 앞으로 가져오지 않고,
 * 닫아 둔 창을 되살리지도 않는다.
 *
 * 메인 창을 닫았다는 것은 Subnota를 트레이/Quick만으로 쓰겠다는 뜻이다.
 * 링크 하나 담았다고 작업 공간이 통째로 튀어나오면 클리핑이 방해가 된다.
 * 다만 저장은 렌더러(로컬 SQLite + Supabase 세션)가 해야 하므로, 창이 정말
 * 없을 때만 **숨긴 채로** 하나 만들어 렌더러를 살린다. 사용자에게는 보이지
 * 않고, 트레이의 `Subnota 열기`를 누르면 그 창이 그대로 앞으로 나온다.
 */
const deliverToMainWindow = (channel: string, payload?: unknown) => {
  const mainWindow = getMainWindow() ?? createWindow({ show: false });

  whenRendererReady(mainWindow, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  });
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
    showMiniForMemo(link.text);
  } else if (DESKTOP_PLATFORM_FEATURES.webClipperDeepLinks) {
    // 웹 클리퍼 딥링크. 브라우저에서 온 저장 요청이라 창을 앞으로 내지 않는다.
    deliverToMainWindow('inbox-capture', { title: link.title, url: link.url });
  }
};

const installApplicationMenu = () => {
  const isMac = DESKTOP_PLATFORM_FEATURES.platform === 'macos';
  const menu = Menu.buildFromTemplate([
    ...(isMac
      ? [
          {
            label: 'Subnota',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                accelerator: shortcutSettings.toggleMini,
                click: () => showMiniForMemo(),
                label: mainT('새 Quick Subnota', 'New Quick Subnota'),
              },
              ...(DESKTOP_PLATFORM_FEATURES.nativeCurrentPageCapture
                ? [
                    {
                      accelerator: shortcutSettings.capturePage,
                      click: (): void => {
                        void captureCurrentBrowserPage();
                      },
                      label: mainT('현재 페이지 저장', 'Save current page'),
                    },
                  ]
                : []),
              { type: 'separator' as const },
              {
                accelerator: 'CommandOrControl+,',
                click: openSettingsWindow,
                label: mainT('설정…', 'Settings…'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: mainT('파일', 'File'),
      submenu: [
        {
          click: () => sendToMainWindow('new-memo'),
          label: mainT('새 메모', 'New Memo'),
        },
        {
          click: () => createWindow(),
          label: mainT('새 창', 'New Window'),
        },
        {
          accelerator: shortcutSettings.toggleMini,
          click: () => showMiniForMemo(),
          label: mainT('새 Quick Subnota', 'New Quick Subnota'),
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                accelerator: 'CommandOrControl+,',
                click: openSettingsWindow,
                label: mainT('설정…', 'Settings…'),
              },
            ]
          : []),
        { type: 'separator' },
        { accelerator: 'CommandOrControl+Shift+W', role: 'close' },
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

const RECENT_INBOX_STATUSES = new Set<NonNullable<RecentInboxItem['summaryStatus']>>([
  'pending',
  'ready',
  'partial',
  'unsupported',
  'failed',
]);

const normalizeRecentInboxItem = (value: unknown): RecentInboxItem | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<RecentInboxItem>;
  const url = normalizeWebUrl(item.url);
  if (!url || typeof item.title !== 'string' || typeof item.sourceLabel !== 'string') {
    return null;
  }
  const summaryStatus = item.summaryStatus;
  if (summaryStatus !== undefined && !RECENT_INBOX_STATUSES.has(summaryStatus)) {
    return null;
  }
  return {
    sourceLabel: item.sourceLabel.trim().slice(0, 100) || '링크',
    summaryStatus,
    title: item.title.trim().slice(0, 500) || url,
    url,
  };
};

let recentInboxItems: RecentInboxItem[] = [];
let hasUnreadInbox = false;
let unreadPulseTimers: Array<ReturnType<typeof setTimeout>> = [];
// 클리핑은 브라우저를 보는 중에 일어난다. 창을 띄우면 그게 방해이고, OS 알림은
// 알림을 꺼 둔 사용자에게 닿지 않는다. 메뉴바는 늘 보이면서 아무것도 가리지
// 않는 유일한 자리라 진행·실패를 여기로 모은다.
let captureInFlight = 0;
let lastCaptureFailure: string | null = null;

const renderTrayTitle = (unreadVisible = hasUnreadInbox) => {
  if (!tray) return;
  if (captureInFlight > 0) {
    tray.setTitle(' ⋯');
    return;
  }
  if (lastCaptureFailure) {
    tray.setTitle(' !');
    return;
  }
  tray.setTitle(unreadVisible ? ' •' : '');
};

const renderUnreadInboxTitle = (visible = hasUnreadInbox) =>
  renderTrayTitle(visible);

const beginCaptureIndicator = () => {
  captureInFlight += 1;
  lastCaptureFailure = null;
  renderTrayTitle();
};

const endCaptureIndicator = (failure?: string) => {
  captureInFlight = Math.max(0, captureInFlight - 1);
  // 실패는 사용자가 확인할 때까지 메뉴바에 남는다 — 알림을 놓쳐도 사라지지
  // 않아야 "담은 줄 알았는데 없더라"가 생기지 않는다.
  if (failure) lastCaptureFailure = failure;
  renderTrayTitle();
  buildTrayMenu();
};

const acknowledgeCaptureFailure = () => {
  lastCaptureFailure = null;
  renderTrayTitle();
  buildTrayMenu();
};

// 성공도 확인할 자리를 준다. 알림을 놓쳤을 때 "담기긴 했나" 를 여기서 본다.
const acknowledgeInboxSave = () => {
  setUnreadInbox(false);
  buildTrayMenu();
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
    return mainT(
      '링크와 메타데이터를 저장했습니다. 본문 요약은 제한적입니다.',
      'Link and metadata saved. The page summary is limited.',
    );
  }
  if (item.summaryStatus === 'failed' || item.summaryStatus === 'unsupported') {
    return mainT(
      '링크는 저장했습니다. 요약은 생성하지 못했습니다.',
      'Link saved, but a summary could not be created.',
    );
  }
  if (item.summaryStatus === 'pending') {
    return mainT(
      '링크를 저장했습니다. 요약을 준비 중입니다.',
      'Link saved. Preparing its summary.',
    );
  }
  return mainT('링크 저장함에 저장됨', 'Saved to Inbox');
};

const getCaptureFailureMessage = (message: string) => {
  if (currentUiLanguage !== 'en') return message;
  if (message.startsWith('지원하는 브라우저의 현재 페이지를 찾지 못했습니다.')) {
    return 'Could not find the current page in a supported browser. Try Safari, Chrome, Arc, Edge, or Brave.';
  }
  if (message.startsWith('브라우저 정보를 가져오지 못했습니다')) {
    return 'Could not read the browser information.';
  }
  if (message === '현재 페이지 저장은 macOS에서만 지원됩니다.') {
    return 'Saving the current page is available on macOS only.';
  }
  if (message === '웹페이지 주소만 저장할 수 있습니다. 브라우저 내부 페이지나 로컬 파일은 지원하지 않습니다.') {
    return 'Only web page addresses can be saved. Browser-internal pages and local files are not supported.';
  }
  return message;
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

  if (!DESKTOP_PLATFORM_FEATURES.recentCapturesInTray) {
    trayMenu = Menu.buildFromTemplate([
      {
        accelerator: shortcutSettings.toggleMini,
        click: () => showMiniForMemo(),
        label: mainT('새 Quick Subnota', 'New Quick Subnota'),
      },
      {
        click: () => {
          const mainWindow = getMainWindow() ?? createWindow();
          mainWindow.show();
          mainWindow.focus();
        },
        label: mainT('Subnota 열기', 'Open Subnota'),
      },
      { accelerator: 'CommandOrControl+,', click: openSettingsWindow, label: mainT('설정', 'Settings') },
      { type: 'separator' },
      { role: 'quit' },
    ]);
    tray.setContextMenu(trayMenu);
    return;
  }

  const recentEntries = recentInboxItems.length
    ? recentInboxItems.map((item) => ({
        click: () => {
          const url = normalizeWebUrl(item.url);
          if (url) void shell.openExternal(url);
        },
        label: `${item.sourceLabel}  ${truncateLabel(item.title, 42)}`,
      }))
    : [{ enabled: false, label: mainT('최근 링크 없음', 'No recent links') }];

  trayMenu = Menu.buildFromTemplate([
      ...(lastCaptureFailure
        ? [
            {
              click: acknowledgeCaptureFailure,
              label: `${mainT('저장하지 못함', 'Could not save')} — ${truncateLabel(getCaptureFailureMessage(lastCaptureFailure), 48)}`,
            },
            { type: 'separator' as const },
          ]
        : hasUnreadInbox && recentInboxItems[0]
          ? [
              {
                click: acknowledgeInboxSave,
                label: `${mainT('링크가 저장되었습니다', 'Link saved')} — ${truncateLabel(recentInboxItems[0].title, 40)}`,
              },
              { type: 'separator' as const },
            ]
          : []),
      { accelerator: shortcutSettings.toggleMini, click: () => showMiniForMemo(), label: mainT('빠른 메모 작성', 'New quick memo') },
      {
        accelerator: shortcutSettings.capturePage,
        click: () => void captureCurrentBrowserPage(),
        label: mainT('현재 페이지 저장', 'Save current page'),
      },
      { type: 'separator' },
      { enabled: false, label: mainT('최근 링크', 'Recent links') },
      ...recentEntries,
      { type: 'separator' },
      {
        click: () => {
          const mainWindow = getMainWindow() ?? createWindow();
          mainWindow.show();
          mainWindow.focus();
        },
        label: mainT('Subnota 열기', 'Open Subnota'),
      },
      { accelerator: 'CommandOrControl+,', click: openSettingsWindow, label: mainT('설정', 'Settings') },
      { role: 'quit' },
    ]);
  // NOTE: do NOT call tray.setContextMenu here. On macOS, attaching a context
  // menu makes a LEFT-click (and one-finger tap) open the menu instead of
  // firing the 'click' handler — which made a plain tap pop the menu (with
  // "설정"). We only show the menu on right-click via popUpContextMenu, so
  // left-click stays as "toggle Quick Subnota".
};

const recordInboxSave = (value: unknown) => {
  const item = normalizeRecentInboxItem(value);
  // 로컬에 들어간 시점이 사용자에겐 "담겼다"이다. 서버 요약은 그 뒤 일이다.
  endCaptureIndicator();
  if (!DESKTOP_PLATFORM_FEATURES.recentCapturesInTray || !item) {
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

const installTrayItem = () => {
  const iconName = DESKTOP_PLATFORM_FEATURES.platform === 'macos'
    ? 'tray.png'
    : 'icon.ico';
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, iconName)
    : path.join(app.getAppPath(), 'resources', iconName);
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    console.error('[Subnota] tray icon failed to load:', iconPath);
    return;
  }

  if (DESKTOP_PLATFORM_FEATURES.platform === 'macos') {
    // tray.png가 이미 18pt(+ @2x 36px)다. 여기서 resize하면 고해상도 표현이
    // 버려져 Retina에서 뭉갠다. 템플릿 이미지는 알파만 쓰이므로 색은 무의미하고,
    // 시스템이 라이트/다크 메뉴바에 맞춰 칠해 준다.
    icon.setTemplateImage(true);
    tray = new Tray(icon);
  } else {
    tray = new Tray(icon);
  }
  tray.setToolTip('Subnota');
  buildTrayMenu();
  tray.on('click', () => {
    setUnreadInbox(false);
    toggleMiniWindow();
  });
  if (DESKTOP_PLATFORM_FEATURES.platform === 'macos') {
    tray.on('right-click', () => {
      buildTrayMenu();
      if (trayMenu) {
        tray?.popUpContextMenu(trayMenu);
      }
    });
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  appReady = true;
  const systemLocale =
    typeof app.getLocale === 'function' ? app.getLocale() : 'en';
  currentUiLanguage = systemLocale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
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
  installTrayItem();

  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('subnota', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient('subnota');
  }
  setupMiniSubnota({
    getAnchorBounds: () => tray?.getBounds() ?? null,
    getFocusContext: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      return {
        focusedMainWindowId:
          focusedWindow && mainWindows.has(focusedWindow)
            ? focusedWindow.id
            : null,
      };
    },
    getRecentInboxItems: () =>
      DESKTOP_PLATFORM_FEATURES.recentCapturesInTray ? recentInboxItems : [],
    preloadPath: path.join(__dirname, 'preload.js'),
    loadRenderer,
    onCapture: (payload) => {
      // 성공 표시는 저장이 끝난 뒤 recordInboxSave에서 확정한다.
      deliverToMainWindow('inbox-capture', payload);
    },
    onCaptureError: (message) => {
      endCaptureIndicator(message);
      deliverToMainWindow('inbox-capture', { error: message });
    },
    onCaptureStart: beginCaptureIndicator,
    onReveal: DESKTOP_PLATFORM_FEATURES.recentCapturesInTray
      ? () => setUnreadInbox(false)
      : undefined,
    restoreMainWindowFocus: (windowId) => {
      const mainWindow =
        Array.from(mainWindows).find(
          window => !window.isDestroyed() && window.id === windowId,
        ) ?? getMainWindow();
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    },
  });
  applyGlobalShortcutSettings(shortcutSettings);

  configureAutoUpdater({
    isPackaged: app.isPackaged,
    notifyRenderer: (channel, info) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channel, info);
      }
    },
    onError: () => {
      if (!nativeUpdateInstallInProgress) return;
      nativeUpdateInstallInProgress = false;
      allowQuitAfterFlush = false;
      appIsQuitting = false;
      quitFlushInProgress = false;
      releaseCancelledLocalWriteGuards();
    },
    onInstallRequested: () => {
      appIsQuitting = true;
    },
  });

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
            `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${POSTHOG_ASSETS_ORIGIN}; ` +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            `connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://*.run.app ${POSTHOG_API_ORIGIN} ${POSTHOG_ASSETS_ORIGIN}; ` +
            // https: matches the packaged-app CSP — inbox thumbnails and
            // domain favicons are remote images.
            "img-src 'self' data: blob: https:",
          ],
        },
      });
    });
  }

  createWindow();

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
