import { describe, expect, it } from 'vitest';

import {
  APP_SHORTCUT_FIELDS,
  APP_SHORTCUT_LABELS,
  APP_SHORTCUT_RESERVED,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  DEFAULT_SHORTCUT_SETTINGS,
  canonicalizeAccelerator,
  findShortcutConflicts,
  findShortcutConflictsForFields,
  formatHotkeyTooltip,
  keyboardEventToAccelerator,
  matchesKeyboardShortcut,
  normalizeAppShortcutSettings,
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
  it('adds the tab, sidebar, and Topics defaults without discarding saved settings', () => {
    const settings = normalizeAppShortcutSettings({
      createMemo: 'CommandOrControl+Shift+N',
    });

    expect(settings.createMemo).toBe('CommandOrControl+Shift+N');
    expect(settings.createTab).toBe('CommandOrControl+T');
    expect(settings.closeActiveTab).toBe('CommandOrControl+W');
    expect(settings.focusPreviousTab).toBe('Control+Shift+Tab');
    expect(settings.focusNextTab).toBe('Control+Tab');
    expect(settings.openTopics).toBe('CommandOrControl+4');
    expect(settings.toggleSidebar).toBe('CommandOrControl+Alt+S');
  });

  it('adds the configured shortcut to a tooltip label', () => {
    expect(formatHotkeyTooltip('새 탭', null)).toBe('새 탭');
    expect(formatHotkeyTooltip('새 탭', 'CommandOrControl+T')).toMatch(
      /^새 탭 · /,
    );
  });

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
  toggleMini: 'Quick Subnota 열기',
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

  it('keeps the native window-close shortcut unavailable to app actions', () => {
    const conflicts = findShortcutConflictsForFields(
      {
        ...DEFAULT_APP_SHORTCUT_SETTINGS,
        createTab: 'CommandOrControl+Shift+W',
      },
      {
        fields: APP_SHORTCUT_FIELDS,
        labels: APP_SHORTCUT_LABELS,
        reserved: APP_SHORTCUT_RESERVED,
      },
    );

    expect(conflicts.createTab).toBe('창 닫기');
  });

  it('keeps native edit and application menu shortcuts unavailable', () => {
    const conflicts = findShortcutConflictsForFields(
      {
        ...DEFAULT_APP_SHORTCUT_SETTINGS,
        createMemo: 'CommandOrControl+Z',
        createTab: 'CommandOrControl+,',
        openInbox: 'CommandOrControl+Q',
      },
      {
        fields: APP_SHORTCUT_FIELDS,
        labels: APP_SHORTCUT_LABELS,
        reserved: APP_SHORTCUT_RESERVED,
      },
    );

    expect(conflicts.createMemo).toBe('실행 취소');
    expect(conflicts.createTab).toBe('설정 열기');
    expect(conflicts.openInbox).toBe('앱 종료');
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
