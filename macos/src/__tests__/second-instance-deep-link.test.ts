import { beforeAll, describe, expect, it, vi } from 'vitest';

const appHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockFocus = vi.fn();
const mockRestore = vi.fn();
const mockSend = vi.fn();
const mockShow = vi.fn();

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
    id = 1;
    webContents = {
      id: 1,
      isLoading: vi.fn(() => false),
      on: vi.fn(),
      once: vi.fn(),
      send: mockSend,
    };
    focus() { mockFocus(); }
    getBounds() { return { height: 820, width: 860, x: 100, y: 100 }; }
    isDestroyed() { return false; }
    isMinimized() { return true; }
    loadFile() { return undefined; }
    loadURL() { return undefined; }
    on() { return undefined; }
    restore() { mockRestore(); }
    setBounds() { return undefined; }
    setMaximumSize() { return undefined; }
    setMinimumSize() { return undefined; }
    show() { mockShow(); }
    static getAllWindows() { return []; }
  },
  globalShortcut: {
    register: vi.fn(() => true),
    unregisterAll: vi.fn(),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => true })),
  },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { height: 900, width: 1440 } }) },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
  Tray: vi.fn(),
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
  default: { existsSync: vi.fn(() => true), promises: { readFile: vi.fn(), writeFile: vi.fn() } },
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

describe('second-instance deep links', () => {
  it('routes capture links to the existing main window and focuses it', () => {
    appHandlers['second-instance']?.({}, [
      '/Applications/Subnota.app',
      'subnota://capture?url=https%3A%2F%2Fexample.com&title=Example',
    ]);

    expect(mockSend).toHaveBeenCalledWith('inbox-capture', {
      title: 'Example',
      url: 'https://example.com',
    });
    expect(mockRestore).toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
  });
});
