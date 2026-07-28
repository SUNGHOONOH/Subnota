import { beforeAll, describe, expect, it, vi } from 'vitest';

const appHandlers: Record<string, (...args: unknown[]) => void> = {};
const ipcHandlers: Record<string, (_event: unknown, ...args: unknown[]) => unknown> = {};
const mockBuildFromTemplate = vi.fn((template: unknown) => ({ template }));
const mockRegister = vi.fn(() => true);
const mockSetApplicationMenu = vi.fn();
const mockSetContextMenu = vi.fn();
const mockUnregisterAll = vi.fn();

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/app',
    isPackaged: false,
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    on: (event: string, cb: (...args: unknown[]) => void) => {
      appHandlers[event] = cb;
    },
  },
  BrowserWindow: class MockBW {
    webContents = { id: 1, on: vi.fn(), once: vi.fn(), send: vi.fn() };
    focus() { return undefined; }
    isDestroyed() { return false; }
    isMinimized() { return false; }
    loadFile() { return undefined; }
    loadURL() { return undefined; }
    on() { return undefined; }
    restore() { return undefined; }
    setBounds() { return undefined; }
    setMinimumSize() { return undefined; }
    show() { return undefined; }
    static getAllWindows() { return []; }
  },
  globalShortcut: {
    register: (...args: unknown[]) => mockRegister(...args),
    unregisterAll: () => mockUnregisterAll(),
  },
  ipcMain: {
    handle: (channel: string, fn: (_event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn;
    },
    on: vi.fn(),
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
  net: { fetch: vi.fn() },
  protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { height: 900, width: 1440 } }) },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), webRequest: { onHeadersReceived: vi.fn() } } },
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
