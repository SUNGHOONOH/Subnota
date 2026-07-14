import { describe, expect, it } from 'vitest';

import { keyboardEventToAccelerator, matchesKeyboardShortcut } from '../lib/shortcutSettings';

const keyEvent = (
  key: string,
  patch: Partial<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {},
) =>
  ({
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    shiftKey: false,
    ...patch,
  }) as KeyboardEvent;

describe('shortcut settings', () => {
  it('converts modifier key presses into Electron accelerators', () => {
    expect(
      keyboardEventToAccelerator(keyEvent('s', { metaKey: true, shiftKey: true })),
    ).toBe('CommandOrControl+Shift+S');
    expect(keyboardEventToAccelerator(keyEvent('k', { ctrlKey: true }))).toBe(
      'CommandOrControl+K',
    );
    expect(keyboardEventToAccelerator(keyEvent(' ', { altKey: true }))).toBe(
      'Alt+Space',
    );
  });

  it('rejects modifier-only and modifier-required plain key presses', () => {
    expect(keyboardEventToAccelerator(keyEvent('Meta'))).toBeNull();
    expect(
      keyboardEventToAccelerator(keyEvent('k'), { requireModifier: true }),
    ).toBeNull();
  });

  it('matches generated accelerators against keyboard events', () => {
    const accelerator = keyboardEventToAccelerator(
      keyEvent('k', { metaKey: true }),
    );
    if (!accelerator) {
      throw new Error('Expected shortcut accelerator');
    }

    expect(accelerator).toBe('CommandOrControl+K');
    expect(matchesKeyboardShortcut(keyEvent('k', { metaKey: true }), accelerator)).toBe(
      true,
    );
  });
});
