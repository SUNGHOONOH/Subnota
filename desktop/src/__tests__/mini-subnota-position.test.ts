import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRegister } = vi.hoisted(() => ({
  mockRegister: vi.fn(() => true),
}));

vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {},
  globalShortcut: {
    register: mockRegister,
    unregisterAll: vi.fn(),
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    getDisplayNearestPoint: vi.fn(() => ({
      workArea: { height: 900, width: 1440, x: 0, y: 0 },
    })),
  },
}));

import {
  calculateMiniWindowPosition,
  getMiniWindowType,
  registerGlobalShortcuts,
} from '../mini-subnota';
import { DEFAULT_SHORTCUT_SETTINGS } from '../lib/shortcutSettings';

beforeEach(() => {
  mockRegister.mockClear();
});

describe('calculateMiniWindowPosition', () => {
  const workArea = { height: 900, width: 1440, x: 0, y: 0 };

  it('positions the mini window under the menu bar tray anchor', () => {
    expect(
      calculateMiniWindowPosition(
        { height: 22, width: 30, x: 1280, y: 860 },
        workArea,
      ),
    ).toEqual({ x: 967, y: 532 });
  });

  it('clamps the mini window inside the visible work area', () => {
    expect(
      calculateMiniWindowPosition(
        { height: 22, width: 30, x: 80, y: 140 },
        workArea,
      ),
    ).toEqual({ x: 16, y: 16 });
  });

  it('falls back to the top-right of the work area without an anchor', () => {
    expect(calculateMiniWindowPosition(null, workArea)).toEqual({
      x: 1044,
      y: 16,
    });
  });
});

describe('getMiniWindowType', () => {
  it('uses a non-activating panel on macOS', () => {
    expect(getMiniWindowType('darwin')).toBe('panel');
  });

  it('keeps the default window type on Windows', () => {
    expect(getMiniWindowType('win32')).toBeUndefined();
  });
});

describe('registerGlobalShortcuts', () => {
  it('registers only Mini Subnota on Windows when capture is disabled', () => {
    expect(
      registerGlobalShortcuts(
        { onCapture: vi.fn(), onToggleMemo: vi.fn() },
        DEFAULT_SHORTCUT_SETTINGS,
        { capture: false },
      ),
    ).toEqual({ capture: true, toggle: true });

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith(
      DEFAULT_SHORTCUT_SETTINGS.toggleMini,
      expect.any(Function),
    );
  });
});
