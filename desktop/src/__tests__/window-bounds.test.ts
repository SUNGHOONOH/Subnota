import { describe, expect, it } from 'vitest';

import {
  MAIN_MIN_SIZE,
  WINDOWS_AUTH_PREFERRED_SIZE,
  createMainWindowMinimumSize,
  createPreferredAuthWindowBounds,
  createPreferredMainContentBounds,
  createPreferredMainWindowBounds,
} from '../lib/windowBounds';

describe('main window bounds', () => {
  it('centers the legacy preferred Subnota window size in the work area', () => {
    expect(
      createPreferredMainWindowBounds({
        height: 900,
        width: 1440,
        x: 0,
        y: 0,
      }),
    ).toEqual({
      height: 820,
      width: 860,
      x: 290,
      y: 40,
    });
  });

  it('keeps the main window at least as large as the legacy minimum size', () => {
    const bounds = createPreferredMainWindowBounds({
      height: 420,
      width: 520,
      x: 100,
      y: 80,
    });

    expect(bounds.width).toBe(MAIN_MIN_SIZE.width);
    expect(bounds.height).toBe(MAIN_MIN_SIZE.height);
  });

  it('fits the Windows content area around its measured native frame', () => {
    expect(
      createPreferredMainContentBounds(
        { height: 900, width: 1440, x: 0, y: 0 },
        { height: 39, width: 16 },
      ),
    ).toEqual({
      height: 820,
      width: 860,
      x: 282,
      y: 21,
    });
  });

  it('keeps a high-DPI Windows window inside a short work area', () => {
    const workArea = { height: 472, width: 911, x: 0, y: 0 };

    expect(
      createPreferredMainContentBounds(workArea, {
        height: 39,
        width: 16,
      }),
    ).toEqual({
      height: 433,
      width: 855,
      x: 20,
      y: 0,
    });
    expect(createMainWindowMinimumSize(workArea)).toEqual({
      height: 472,
      width: 560,
    });
  });

  it('keeps the Windows auth window inside a small work area', () => {
    expect(
      createPreferredAuthWindowBounds(
        { height: 650, width: 900, x: 20, y: 30 },
        WINDOWS_AUTH_PREFERRED_SIZE,
      ),
    ).toEqual({
      height: 610,
      width: 860,
      x: 40,
      y: 50,
    });
  });

  it('allows the scrollable auth screen to fit a work area below the main minimum', () => {
    expect(
      createPreferredAuthWindowBounds(
        { height: 420, width: 520, x: 0, y: 0 },
        WINDOWS_AUTH_PREFERRED_SIZE,
      ),
    ).toEqual({
      height: 380,
      width: 480,
      x: 20,
      y: 20,
    });
  });
});
