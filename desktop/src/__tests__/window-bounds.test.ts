import { describe, expect, it } from 'vitest';

import {
  MAIN_MIN_SIZE,
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
});
