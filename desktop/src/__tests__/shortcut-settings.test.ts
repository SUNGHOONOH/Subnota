import { describe, expect, it } from 'vitest';

import {
  APP_SHORTCUT_FIELDS,
  APP_SHORTCUT_LABELS,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  DEFAULT_SHORTCUT_SETTINGS,
  canonicalizeAccelerator,
  findShortcutConflicts,
  findShortcutConflictsForFields,
  keyboardEventToAccelerator,
  matchesKeyboardShortcut,
  toMantineHotkey,
} from '../lib/shortcutSettings';

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

  it('converts Electron accelerators to Mantine hotkeys', () => {
    expect(toMantineHotkey('CommandOrControl+Alt+Left')).toBe('mod+alt+arrowleft');
    expect(toMantineHotkey('Shift+CommandOrControl+Y')).toBe('shift+mod+y');
    expect(toMantineHotkey('CommandOrControl+\\')).toBe('mod+\\');
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

const LABELS = {
  capturePage: '현재 페이지 저장',
  openSearch: '메모 검색',
  toggleMini: 'Mini Subnota 열기',
};

describe('shortcut conflicts', () => {
  it('uses safe defaults and detects conflicts across app and global shortcuts', () => {
    expect(DEFAULT_SHORTCUT_SETTINGS.capturePage).toBe(
      'Shift+CommandOrControl+Y',
    );
    expect(DEFAULT_SHORTCUT_SETTINGS.toggleMini).toBe('Alt+Y');

    const conflicts = findShortcutConflictsForFields(
      {
        ...DEFAULT_APP_SHORTCUT_SETTINGS,
        ...DEFAULT_SHORTCUT_SETTINGS,
        openSearch: DEFAULT_APP_SHORTCUT_SETTINGS.openCalendar,
      },
      {
        fields: [...APP_SHORTCUT_FIELDS, 'capturePage', 'openSearch', 'toggleMini'],
        labels: { ...APP_SHORTCUT_LABELS, ...LABELS },
      },
    );

    expect(conflicts.openSearch).toBe(APP_SHORTCUT_LABELS.openCalendar);
  });

  it('canonicalizes different spellings of the same combination', () => {
    expect(canonicalizeAccelerator('Shift+CommandOrControl+S')).toBe(
      canonicalizeAccelerator('CommandOrControl+Shift+S'),
    );
    expect(canonicalizeAccelerator('mod+ArrowLeft')).toBe(
      canonicalizeAccelerator('CommandOrControl+Left'),
    );
    expect(canonicalizeAccelerator('cmdOrCtrl+alt+n')).toBe(
      'CommandOrControl+Alt+N',
    );
    expect(canonicalizeAccelerator('Shift')).toBeNull();
  });

  it('flags duplicates between fields regardless of modifier order', () => {
    const conflicts = findShortcutConflicts(
      {
        capturePage: 'Shift+CommandOrControl+S',
        openSearch: 'CommandOrControl+Shift+F',
        toggleMini: 'CommandOrControl+Shift+S',
      },
      { labels: LABELS },
    );

    expect(conflicts.toggleMini).toBe(LABELS.capturePage);
    expect(conflicts.capturePage).toBe(LABELS.toggleMini);
    expect(conflicts.openSearch).toBeUndefined();
  });

  it('flags collisions with reserved app hotkeys', () => {
    const conflicts = findShortcutConflicts(
      {
        capturePage: 'Shift+CommandOrControl+S',
        openSearch: 'CommandOrControl+N',
        toggleMini: 'Alt+S',
      },
      { labels: LABELS, reserved: [{ accelerator: 'mod+N', label: '새 메모 생성' }] },
    );

    expect(conflicts.openSearch).toBe('새 메모 생성');
    expect(conflicts.capturePage).toBeUndefined();
    expect(conflicts.toggleMini).toBeUndefined();
  });

  it('ignores fields that are not editable on this platform', () => {
    const settings = {
      capturePage: 'Alt+S',
      openSearch: 'Shift+CommandOrControl+F',
      toggleMini: 'Alt+S',
    };

    expect(findShortcutConflicts(settings, { labels: LABELS })).toEqual({
      capturePage: LABELS.toggleMini,
      toggleMini: LABELS.capturePage,
    });
    expect(
      findShortcutConflicts(settings, {
        fields: ['toggleMini', 'openSearch'],
        labels: LABELS,
      }),
    ).toEqual({});
  });
});
