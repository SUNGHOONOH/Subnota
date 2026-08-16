import { beforeAll, describe, expect, it, vi } from 'vitest';

const appHandlers: Record<string, (...args: unknown[]) => void> = {};
const ipcHandlers: Record<string, (_event: unknown, ...args: unknown[]) => unknown> = {};
const ipcEventHandlers: Record<string, (_event: unknown, ...args: unknown[]) => void> = {};
const mockBuildFromTemplate = vi.fn((template: unknown) => ({ template }));
const mockAppQuit = vi.fn();
const mockRegister = vi.fn(() => true);
const mockRendererSend = vi.fn();
const mockShowMessageBox = vi.fn(async () => ({ checkboxChecked: false, response: 0 }));
const mockSetApplicationMenu = vi.fn();
const mockSetContextMenu = vi.fn();
const mockSetPermissionRequestHandler = vi.fn();
const mockUnregisterAll = vi.fn();
const mockClipboardWriteText = vi.fn();
const mockInstallNativeUpdate = vi.fn();
const mockFlushLocalDatabaseOperations = vi.fn(async () => undefined);
const localDatabaseLifecycleState = vi.hoisted(() => ({
  hooks: null as null | {
    acquireRendererWriteGuard: () => Promise<{
      release: (cancelled: boolean) => void;
    } | null>;
  },
}));
const browserWindowState = vi.hoisted(() => ({
  instances: [] as Array<{
    close: () => void;
    destroyed: boolean;
    id: number;
    listeners: Record<string, Array<(...args: unknown[]) => void>>;
    webContents: {
      id: number;
      send: ReturnType<typeof vi.fn>;
    };
  }>,
}));
const notificationState = vi.hoisted(() => ({
  instances: [] as Array<{
    close: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => void;
    options: Record<string, unknown>;
  }>,
  isSupported: vi.fn(() => true),
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/app',
    getPath: () => '/tmp',
    isPackaged: false,
    quit: () => mockAppQuit(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    on: (event: string, cb: (...args: unknown[]) => void) => {
      appHandlers[event] = cb;
    },
  },
  BrowserWindow: class MockBW {
    destroyed = false;
    id = browserWindowState.instances.length + 1;
    listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    webContents = {
      id: this.id,
      isDestroyed: () => this.destroyed,
      isLoading: () => false,
      on: vi.fn(),
      once: vi.fn(),
      send: vi.fn((...args: unknown[]) => mockRendererSend(...args)),
    };
    constructor() { browserWindowState.instances.push(this); }
    close() {
      const event = { preventDefault: vi.fn() };
      for (const listener of this.listeners.close ?? []) listener(event);
      if (event.preventDefault.mock.calls.length > 0) return;
      this.destroyed = true;
      for (const listener of this.listeners.closed ?? []) listener();
    }
    focus() { return undefined; }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return false; }
    loadFile() { return undefined; }
    loadURL() { return undefined; }
    on(event: string, listener: (...args: unknown[]) => void) {
      (this.listeners[event] ??= []).push(listener);
      return this;
    }
    restore() { return undefined; }
    setBounds() { return undefined; }
    setMinimumSize() { return undefined; }
    show() { return undefined; }
    static getAllWindows() {
      return browserWindowState.instances.filter(window => !window.destroyed);
    }
  },
  clipboard: { writeText: (...args: unknown[]) => mockClipboardWriteText(...args) },
  dialog: {
    showMessageBox: (...args: unknown[]) => mockShowMessageBox(...args),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  globalShortcut: {
    register: (...args: unknown[]) => mockRegister(...args),
    unregisterAll: () => mockUnregisterAll(),
  },
  ipcMain: {
    handle: (channel: string, fn: (_event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn;
    },
    on: (channel: string, fn: (_event: unknown, ...args: unknown[]) => void) => {
      ipcEventHandlers[channel] = fn;
    },
  },
  Menu: {
    buildFromTemplate: (template: unknown) => mockBuildFromTemplate(template),
    setApplicationMenu: (menu: unknown) => mockSetApplicationMenu(menu),
  },
  nativeImage: {
    createFromPath: vi.fn(() => {
      const image = {
        isEmpty: () => false,
        resize: () => image,
        setTemplateImage: () => undefined,
      };
      return image;
    }),
  },
  Notification: class MockNotification {
    handlers: Record<string, (...args: unknown[]) => void> = {};
    close = vi.fn();
    constructor(public options: Record<string, unknown>) {
      notificationState.instances.push(this);
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers[event]?.(...args);
    }
    once(event: string, listener: (...args: unknown[]) => void) {
      this.handlers[event] = listener;
      return this;
    }
    show() { return undefined; }
    static isSupported() { return notificationState.isSupported(); }
  },
  net: { fetch: vi.fn() },
  protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { height: 900, width: 1440 } }) },
  session: { defaultSession: { setPermissionRequestHandler: (...args: unknown[]) => mockSetPermissionRequestHandler(...args), webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
  Tray: class MockTray {
    on() { return undefined; }
    setContextMenu(menu: unknown) { mockSetContextMenu(menu); }
    setTitle() { return undefined; }
    setToolTip() { return undefined; }
  },
}));

vi.mock('electron-squirrel-startup', () => ({ default: false }));
vi.mock('../platform/policy', () => ({
  COLD_START_ARG: '--subnota-cold-start',
  DESKTOP_PLATFORM_FEATURES: {
    browserExtensionClipper: false,
    captureShortcut: true,
    manualLinkCapture: true,
    miniSubnota: true,
    nativeCurrentPageCapture: true,
    platform: 'macos',
    recentCapturesInTray: true,
    trayQuickMemo: true,
    webClipperDeepLinks: true,
    webInbox: true,
  },
}));
vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: vi.fn(),
  configureAutoUpdater: vi.fn(),
  installNativeUpdate: () => mockInstallNativeUpdate(),
}));
vi.mock('../local-database', () => ({
  configureLocalDatabaseMaintenanceHooks: (hooks: typeof localDatabaseLifecycleState.hooks) => {
    localDatabaseLifecycleState.hooks = hooks;
  },
  flushLocalDatabaseOperations: () => mockFlushLocalDatabaseOperations(),
}));
vi.mock('../update-checker', () => ({ checkForUpdate: vi.fn() }));
vi.mock('../window-close-handler', () => ({ attachCloseHandler: vi.fn() }));
vi.mock('node:fs', () => ({
  default: {
    promises: { readFile: vi.fn(), writeFile: vi.fn() },
    readFileSync: vi.fn(() => {
      throw new Error('missing preferences');
    }),
    writeFileSync: vi.fn(),
  },
}));
vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}));

const builtTemplatesContain = (value: string) =>
  mockBuildFromTemplate.mock.calls.some(([template]) =>
    JSON.stringify(template).includes(value),
  );

beforeAll(async () => {
  (globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined;
  (globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_NAME = 'main_window';
  await import('../main');
  appHandlers.ready?.();
});

describe('macOS global shortcut main process wiring', () => {
  it('updates global shortcuts and menu accelerators, then falls back on registration failure', () => {
    const setGlobalShortcuts = ipcHandlers['set-global-shortcuts'];
    expect(setGlobalShortcuts).toBeTypeOf('function');

    const accepted = setGlobalShortcuts({}, {
      capturePage: 'CommandOrControl+Shift+Y',
      openSearch: 'CommandOrControl+K',
      toggleMini: 'Alt+Y',
    });

    expect(accepted).toEqual({
      registered: { capture: true, toggle: true },
      settings: {
        capturePage: 'CommandOrControl+Shift+Y',
        openSearch: 'CommandOrControl+K',
        toggleMini: 'Alt+Y',
      },
    });
    expect(mockRegister).toHaveBeenCalledWith(
      'CommandOrControl+Shift+Y',
      expect.any(Function),
    );
    expect(mockRegister).toHaveBeenCalledWith('Alt+Y', expect.any(Function));
    expect(builtTemplatesContain('CommandOrControl+Shift+Y')).toBe(true);
    expect(builtTemplatesContain('Alt+Y')).toBe(true);
    expect(mockSetApplicationMenu).toHaveBeenCalled();
    // The tray menu is built (template above) but intentionally NOT attached via
    // setContextMenu — that would make a left-click/tap open the menu.
    expect(mockSetContextMenu).not.toHaveBeenCalled();

    mockRegister.mockImplementation((accelerator) => accelerator !== 'BadShortcut');
    const fallback = setGlobalShortcuts({}, {
      capturePage: 'BadShortcut',
      openSearch: 'CommandOrControl+K',
      toggleMini: 'Alt+N',
    });

    // 설정은 이전 값으로 되돌아가지만 registered는 실패한 쪽(capture)을
    // 그대로 보고해야 한다. 롤백 등록 결과(전부 true)를 돌려주면 호출자가
    // 실패를 성공으로 읽고 "저장했습니다"를 띄운다.
    expect(fallback).toEqual({
      registered: { capture: false, toggle: true },
      settings: {
        capturePage: 'CommandOrControl+Shift+Y',
        openSearch: 'CommandOrControl+K',
        toggleMini: 'Alt+Y',
      },
    });
    expect(mockUnregisterAll).toHaveBeenCalled();
    // 롤백은 말뿐이 아니라 이전 조합을 실제로 다시 등록해야 한다.
    expect(mockRegister).toHaveBeenLastCalledWith(
      'CommandOrControl+Shift+Y',
      expect.any(Function),
    );
  });

  it('suspends and restores global shortcuts while a shortcut is being recorded', () => {
    const suspend = ipcHandlers['suspend-global-shortcuts'];
    expect(suspend).toBeTypeOf('function');

    mockUnregisterAll.mockClear();
    mockRegister.mockClear();

    suspend({}, true);
    expect(mockUnregisterAll).toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();

    suspend({}, false);
    expect(mockRegister).toHaveBeenCalledWith('Alt+Y', expect.any(Function));
  });
});

describe('main-process clipboard bridge', () => {
  it('writes trusted renderer text through the native clipboard', () => {
    const copyText = ipcHandlers['clipboard:write-text'];
    expect(copyText).toBeTypeOf('function');

    expect(copyText({}, 'Markdown text')).toBe(true);
    expect(mockClipboardWriteText).toHaveBeenCalledWith('Markdown text');
    expect(() => copyText({}, 42)).toThrow('Invalid clipboard text.');
  });
});

describe('main-process clip notifications', () => {
  it('keeps renderer permissions denied and shows the fixed native notification', () => {
    const permissionHandler = mockSetPermissionRequestHandler.mock.calls[0]?.[0] as (
      webContents: unknown,
      permission: string,
      callback: (allowed: boolean) => void,
    ) => void;
    const permissionResult = vi.fn();
    permissionHandler({}, 'notifications', permissionResult);
    expect(permissionResult).toHaveBeenCalledWith(false);

    const sender = {
      getURL: () => '',
      id: 7,
      isDestroyed: () => false,
      send: vi.fn(),
    };
    const show = ipcHandlers['clip-notification:show'];
    expect(show({ sender }, {
      body: 'SQLite WAL 모드 정리',
      id: 'clip-1',
      kind: 'saved',
    })).toBe(true);

    const notification = notificationState.instances.at(-1);
    expect(notification?.options.body).toBe('SQLite WAL 모드 정리');
    expect(['수집함에 저장했어요', 'Saved to Inbox']).toContain(
      notification?.options.title,
    );
    notification?.emit('click', {});
    expect(sender.send).toHaveBeenCalledWith('clip-notification:event', {
      action: 'click',
      id: 'clip-1',
    });
    expect(notification?.close).toHaveBeenCalledOnce();
  });

  it('rejects renderer-controlled notification kinds and oversized bodies', () => {
    const show = ipcHandlers['clip-notification:show'];
    const sender = {
      getURL: () => '',
      id: 7,
      isDestroyed: () => false,
      send: vi.fn(),
    };
    expect(() => show({ sender }, {
      body: 'message',
      id: 'clip-2',
      kind: 'arbitrary',
    })).toThrow('Invalid clip notification');
    expect(() => show({ sender }, {
      body: 'x'.repeat(1_001),
      id: 'clip-3',
      kind: 'failed',
    })).toThrow('Invalid clip notification');
  });
});

const latestFlushRequest = () => {
  const call = [...mockRendererSend.mock.calls]
    .reverse()
    .find(([channel]) => channel === 'flush-pending-local-writes');
  return call?.[1] as
    | { reason: LocalWriteFlushReason; requestId: string }
    | undefined;
};

const flushRequestsForWindow = (windowId: number) => {
  const window = browserWindowState.instances.find(item => item.id === windowId);
  return (window?.webContents.send.mock.calls ?? [])
    .filter(([channel]) => channel === 'flush-pending-local-writes')
    .map(
      ([, payload]) =>
        payload as {
          reason: LocalWriteFlushReason;
          requestId: string;
        },
    );
};

const acknowledgeFlush = (windowId: number, requestId: string, ok = true) => {
  ipcEventHandlers['flush-pending-local-writes-complete'](
    { sender: { getURL: () => '', id: windowId } },
    { ok, requestId },
  );
};

const clickNewWindowMenuItem = () => {
  const templates = mockBuildFromTemplate.mock.calls.map(([template]) => template);
  const visit = (value: unknown): (() => void) | null => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (!value || typeof value !== 'object') return null;
    const item = value as { click?: unknown; label?: unknown; submenu?: unknown };
    if (item.label === 'New Window' && typeof item.click === 'function') {
      return item.click as () => void;
    }
    return visit(item.submenu);
  };
  for (const template of templates.reverse()) {
    const click = visit(template);
    if (click) {
      click();
      return;
    }
  }
  throw new Error('Missing New Window menu item.');
};

describe('pending local write shutdown handshake', () => {
  it('aborts update installation when the renderer reports a flush failure', async () => {
    mockInstallNativeUpdate.mockClear();
    mockRendererSend.mockClear();
    const install = ipcHandlers['install-update'];
    const promise = install({});
    await vi.waitFor(() => expect(latestFlushRequest()).toBeDefined());
    const request = latestFlushRequest();
    expect(request?.reason).toBe('shutdown');
    ipcEventHandlers['flush-pending-local-writes-complete'](
      { sender: { getURL: () => '', id: 1 } },
      { ok: false, requestId: request?.requestId },
    );

    await expect(promise).rejects.toThrow('업데이트를 중단');
    expect(mockInstallNativeUpdate).not.toHaveBeenCalled();
  });

  it('keeps the app running when a quit flush times out', async () => {
    vi.useFakeTimers();
    mockAppQuit.mockClear();
    mockRendererSend.mockClear();
    mockShowMessageBox.mockClear();
    const preventDefault = vi.fn();

    appHandlers['before-quit']?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(latestFlushRequest()).toBeDefined();
    expect(latestFlushRequest()?.reason).toBe('shutdown');
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockAppQuit).not.toHaveBeenCalled();
    expect(mockShowMessageBox).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('flushes a non-final app window before allowing it to be destroyed', async () => {
    const setPreferences = ipcHandlers['desktop-preferences:set'];
    setPreferences({}, { closeBehavior: 'quit', launchAtLogin: false });
    clickNewWindowMenuItem();
    const windows = browserWindowState.instances.filter(
      window => !window.destroyed,
    );
    expect(windows).toHaveLength(2);
    const [remainingWindow, closingWindow] = windows;
    remainingWindow.webContents.send.mockClear();
    closingWindow.webContents.send.mockClear();

    closingWindow.close();
    await vi.waitFor(() =>
      expect(flushRequestsForWindow(closingWindow.id)).toHaveLength(1),
    );
    expect(flushRequestsForWindow(closingWindow.id)[0].reason).toBe(
      'window-close',
    );
    expect(flushRequestsForWindow(remainingWindow.id)).toHaveLength(0);
    acknowledgeFlush(
      closingWindow.id,
      flushRequestsForWindow(closingWindow.id)[0].requestId,
    );

    await vi.waitFor(() => expect(closingWindow.destroyed).toBe(true));
    expect(remainingWindow.destroyed).toBe(false);
  });

  it('quits only after a matching renderer flush acknowledgement', async () => {
    mockAppQuit.mockClear();
    mockRendererSend.mockClear();
    const preventDefault = vi.fn();

    appHandlers['before-quit']?.({ preventDefault });
    await vi.waitFor(() => expect(latestFlushRequest()).toBeDefined());
    const request = latestFlushRequest();
    expect(request?.reason).toBe('shutdown');
    ipcEventHandlers['flush-pending-local-writes-complete'](
      { sender: { getURL: () => '', id: 1 } },
      { ok: true, requestId: request?.requestId },
    );

    await vi.waitFor(() => expect(mockAppQuit).toHaveBeenCalledOnce());
  });

  it('flushes every app window before granting database maintenance', async () => {
    clickNewWindowMenuItem();
    const windows = browserWindowState.instances.filter(
      window => !window.destroyed,
    );
    expect(windows).toHaveLength(2);
    for (const window of windows) window.webContents.send.mockClear();

    const guardPromise =
      localDatabaseLifecycleState.hooks?.acquireRendererWriteGuard();
    if (!guardPromise) throw new Error('Missing database maintenance hooks.');
    await vi.waitFor(() => {
      for (const window of windows) {
        expect(flushRequestsForWindow(window.id)).toHaveLength(1);
        expect(flushRequestsForWindow(window.id)[0].reason).toBe(
          'database-maintenance',
        );
      }
    });
    for (const window of windows) {
      acknowledgeFlush(
        window.id,
        flushRequestsForWindow(window.id)[0].requestId,
      );
    }

    const guard = await guardPromise;
    expect(guard).not.toBeNull();
    guard?.release(false);
  });
});
