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
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { height: 900, width: 1440 } }) },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
  Tray: class MockTray {
    on() { return undefined; }
    setContextMenu(menu: unknown) { mockSetContextMenu(menu); }
    setTitle() { return undefined; }
    setToolTip() { return undefined; }
  },
}));

vi.mock('electron-squirrel-startup', () => ({ default: false }));
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

    expect(fallback).toEqual({
      registered: { capture: true, toggle: true },
      settings: {
        capturePage: 'CommandOrControl+Shift+Y',
        openSearch: 'CommandOrControl+K',
        toggleMini: 'Alt+Y',
      },
    });
    expect(mockUnregisterAll).toHaveBeenCalled();
  });
});
