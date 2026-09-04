import { beforeAll, describe, expect, it, vi } from 'vitest';

const appHandlers: Record<string, (...args: unknown[]) => void> = {};
const ipcEventHandlers: Record<string, (...args: unknown[]) => void> = {};
const ipcInvokeHandlers: Record<string, (...args: unknown[]) => unknown> = {};
const constructorOptions: Array<Record<string, unknown>> = [];
const mockBuildFromTemplate = vi.fn((template: unknown) => ({ template }));
const mockRegister = vi.fn(() => true);
const mockSend = vi.fn();
const mockSetContentSize = vi.fn();
const mockSetContextMenu = vi.fn();
const mockSetMaximumSize = vi.fn();
const mockSetMinimumSize = vi.fn();
const mockSetPosition = vi.fn();
const mockShow = vi.fn();

vi.mock('../platform/policy', () => ({
  COLD_START_ARG: '--subnota-cold-start',
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

const mockSetJumpList = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/app',
    isPackaged: false,
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    setJumpList: mockSetJumpList,
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
    setContentSize(...args: unknown[]) { return mockSetContentSize(...args); }
    setMaximumSize(...args: unknown[]) { return mockSetMaximumSize(...args); }
    setMinimumSize(...args: unknown[]) { return mockSetMinimumSize(...args); }
    setPosition(...args: unknown[]) { return mockSetPosition(...args); }
    show() { return mockShow(); }
    getBounds() { return { height: 859, width: 876, x: 0, y: 0 }; }
    getContentBounds() { return { height: 820, width: 860, x: 8, y: 31 }; }
    static fromWebContents() { return new this({}); }
    static getAllWindows() { return []; }
  },
  globalShortcut: {
    register: (...args: unknown[]) => mockRegister(...args),
    unregisterAll: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      ipcInvokeHandlers[channel] = fn;
    },
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
  it('keeps Quick Subnota in the notification area with a paste-based capture', () => {
    const templates = JSON.stringify(mockBuildFromTemplate.mock.calls);

    expect(/새 Quick Subnota|New Quick Subnota/.test(templates)).toBe(true);
    // Windows도 캡처 항목과 최근 링크를 갖는다. 다만 자동 조회가 없으므로
    // "현재" 페이지라고 부르지 않는다.
    expect(templates).toContain('Save a page');
    expect(templates).not.toContain('Save current page');
    expect(templates).toContain('Recent links');
    // Windows 11은 새 트레이 아이콘을 오버플로에 숨긴다. 작업 표시줄
    // 점프 리스트는 항상 보이므로 같은 항목을 여기에도 건다.
    const jumpList = JSON.stringify(mockSetJumpList.mock.calls);
    expect(jumpList).toContain('subnota://memo');
    expect(jumpList).toContain('subnota://link');
    expect(jumpList).toContain('Save a page');
    expect(mockSetContextMenu).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(constructorOptions[0]).not.toHaveProperty('titleBarStyle');
    expect(constructorOptions[0]).toHaveProperty('autoHideMenuBar', true);
    expect(constructorOptions[0]).toHaveProperty('useContentSize', true);
    expect(constructorOptions[0]).toHaveProperty('show', false);
    expect(mockSetContentSize).toHaveBeenCalledWith(860, 820);
    expect(mockSetPosition).toHaveBeenCalledWith(282, 21);
    expect(mockShow).toHaveBeenCalled();
  });

  it('does not route unreleased web clipper deep links into the inbox', () => {
    mockSend.mockClear();
    appHandlers['second-instance']?.({}, [
      'Subnota.exe',
      'subnota://capture?url=https%3A%2F%2Fexample.com&title=Example',
    ]);

    expect(mockSend).not.toHaveBeenCalledWith('inbox-capture', expect.anything());
  });

  it('still accepts Quick Subnota save notifications', () => {
    expect(ipcEventHandlers['mini-saved']).toBeTypeOf('function');
  });

  it('clears the native maximum after leaving the auth screen', () => {
    const setAuthWindowMode = ipcInvokeHandlers['set-auth-window-mode'];
    expect(setAuthWindowMode).toBeTypeOf('function');

    setAuthWindowMode({ sender: {} }, true);
    expect(mockSetMaximumSize).toHaveBeenLastCalledWith(960, 680);

    setAuthWindowMode({ sender: {} }, false);
    expect(mockSetMaximumSize).toHaveBeenLastCalledWith(
      2_147_483_647,
      2_147_483_647,
    );
  });
});
