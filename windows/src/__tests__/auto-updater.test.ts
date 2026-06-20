import { describe, expect, it, vi } from 'vitest';

import {
  checkForNativeUpdate,
  configureAutoUpdater,
  installNativeUpdate,
} from '../auto-updater';

describe('Windows auto updater bridge', () => {
  it('does not configure the macOS Squirrel.Mac native update feed', () => {
    const notifyRenderer = vi.fn();

    const result = configureAutoUpdater({
      isPackaged: true,
      notifyRenderer,
    });

    expect(result).toBe(false);
    expect(notifyRenderer).not.toHaveBeenCalled();
  });

  it('lets the GitHub EXE update checker handle Windows updates', () => {
    expect(checkForNativeUpdate()).toBe(false);
  });

  it('keeps installUpdate IPC harmless when no native update was downloaded', () => {
    expect(() => installNativeUpdate()).not.toThrow();
  });
});
