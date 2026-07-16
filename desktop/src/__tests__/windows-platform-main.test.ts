import { beforeAll, describe, expect, it, vi } from 'vitest';

const appHandlers: Record<string, (...args: unknown[]) => void> = {};
const ipcEventHandlers: Record<string, (...args: unknown[]) => void> = {};
const constructorOptions: Array<Record<string, unknown>> = [];
const mockBuildFromTemplate = vi.fn((template: unknown) => ({ template }));
const mockRegister = vi.fn(() => true);
const mockSend = vi.fn();
const mockSetContextMenu = vi.fn();

vi.mock('../platform/policy', () => ({
  DESKTOP_PLATFORM_FEATURES: {
    browserExtensionClipper: false,
    captureShortcut: false,
    manualLinkCapture: true,
    miniSubnota: true,
    nativeCurrentPageCapture: false,
    platform: 'windows',
    recentCapturesInTray: false,
    trayQuickMemo: true,
    webClipperDeepLinks: false,
    webInbox: true,
  },
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/app',
    isPackaged: false,
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    setLoginItemSettings: vi.fn(),
    on: (event: string, cb: (...args: unknown[]) => void) => {
      appHandlers[event] = cb;
    },
  },
  BrowserWindow: class MockBrowserWindow {
    id = 1;
    webContents = {
      id: 1,
      isLoading: vi.fn(() => false),
      on: vi.fn(),
      once: vi.fn(),
      send: mockSend,
    };
    constructor(options: Record<string, unknown>) {
      constructorOptions.push(options);
    }
    focus() { return undefined; }
    isDestroyed() { return false; }
    isMinimized() { return false; }
    loadURL() { return undefined; }
    on() { return undefined; }
    restore() { return undefined; }
    setBounds() { return undefined; }
    setMaximumSize() { return undefined; }
    setMinimumSize() { return undefined; }
    show() { return undefined; }
    static getAllWindows() { return []; }
  },
  globalShortcut: {
    register: (...args: unknown[]) => mockRegister(...args),
    unregisterAll: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: (channel: string, fn: (...args: unknown[]) => void) => {
      ipcEventHandlers[channel] = fn;
    },
  },
  Menu: {
    buildFromTemplate: (template: unknown) => mockBuildFromTemplate(template),
    setApplicationMenu: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => false })),
  },
  net: { fetch: vi.fn() },
  protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
  screen: {
    getPrimaryDisplay: () => ({
      workArea: { height: 900, width: 1440, x: 0, y: 0 },
      workAreaSize: { height: 900, width: 1440 },
    }),
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(),
      webRequest: { onHeadersReceived: vi.fn() },
    },
  },
  shell: { openExternal: vi.fn() },
  Tray: class MockTray {
    getBounds() { return { height: 20, width: 20, x: 1300, y: 860 }; }
    on() { return undefined; }
    setContextMenu(menu: unknown) { mockSetContextMenu(menu); }
    setTitle() { return undefined; }
    setToolTip() { return undefined; }
  },
}));

vi.mock('electron-squirrel-startup', () => ({ default: false }));
vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: vi.fn(() => false),
  configureAutoUpdater: vi.fn(),
  installNativeUpdate: vi.fn(),
}));
vi.mock('../update-checker', () => ({ checkForUpdate: vi.fn() }));
vi.mock('../window-close-handler', () => ({ attachCloseHandler: vi.fn() }));
vi.mock('node:fs', () => ({
  default: { promises: { readFile: vi.fn(), writeFile: vi.fn() } },
}));
vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}));

beforeAll(async () => {
  (globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined;
  (globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_NAME = 'main_window';
  await import('../main');
  appHandlers.ready?.();
});

describe('Windows desktop policy wiring', () => {
  it('keeps Mini Subnota in the notification area without capture UI', () => {
    const templates = JSON.stringify(mockBuildFromTemplate.mock.calls);

    expect(templates).toContain('새 Mini Subnota');
    expect(templates).not.toContain('현재 페이지 저장');
    expect(templates).not.toContain('최근 수집함');
    expect(mockSetContextMenu).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(constructorOptions[0]).not.toHaveProperty('titleBarStyle');
  });

  it('does not route unreleased web clipper deep links into the inbox', () => {
    mockSend.mockClear();
    appHandlers['second-instance']?.({}, [
      'Subnota.exe',
      'subnota://capture?url=https%3A%2F%2Fexample.com&title=Example',
    ]);

    expect(mockSend).not.toHaveBeenCalledWith('inbox-capture', expect.anything());
  });

  it('still accepts Mini Subnota save notifications', () => {
    expect(ipcEventHandlers['mini-saved']).toBeTypeOf('function');
  });
});
