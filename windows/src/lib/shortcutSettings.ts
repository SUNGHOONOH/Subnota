export interface ShortcutSettings {
  openSearch: string;
}

export const SHORTCUT_STORAGE_KEY = 'subnota.shortcuts.v1';

export const DEFAULT_SHORTCUT_SETTINGS: ShortcutSettings = {
  openSearch: 'CommandOrControl+K',
};

const readShortcutValue = (
  value: unknown,
  fallback: string,
) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

export const normalizeShortcutSettings = (
  value?: Partial<ShortcutSettings> | null,
): ShortcutSettings => ({
  openSearch: readShortcutValue(
    value?.openSearch,
    DEFAULT_SHORTCUT_SETTINGS.openSearch,
  ),
});

export const loadShortcutSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SHORTCUT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    return raw
      ? normalizeShortcutSettings(JSON.parse(raw) as Partial<ShortcutSettings>)
      : DEFAULT_SHORTCUT_SETTINGS;
  } catch {
    return DEFAULT_SHORTCUT_SETTINGS;
  }
};

export const saveShortcutSettings = (settings: ShortcutSettings) => {
  const normalized = normalizeShortcutSettings(settings);

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
};

const normalizeKey = (key: string) => {
  if (key === ' ') {
    return 'space';
  }
  return key.toLowerCase();
};

const MODIFIER_KEYS = new Set([
  'Alt',
  'Control',
  'Meta',
  'Shift',
]);

const normalizeAcceleratorKey = (key: string) => {
  if (MODIFIER_KEYS.has(key)) {
    return null;
  }
  if (key === ' ') {
    return 'Space';
  }
  if (key === 'ArrowUp') {
    return 'Up';
  }
  if (key === 'ArrowDown') {
    return 'Down';
  }
  if (key === 'ArrowLeft') {
    return 'Left';
  }
  if (key === 'ArrowRight') {
    return 'Right';
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
};

export const keyboardEventToAccelerator = (
  event: Pick<
    KeyboardEvent,
    'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'
  >,
  options: { requireModifier?: boolean } = {},
) => {
  const key = normalizeAcceleratorKey(event.key);
  if (!key) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    modifiers.push('CommandOrControl');
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }

  if (options.requireModifier && modifiers.length === 0) {
    return null;
  }

  return [...modifiers, key].join('+');
};

export const matchesKeyboardShortcut = (
  event: KeyboardEvent,
  accelerator: string,
) => {
  const tokens = accelerator
    .split('+')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
  const wantsShift = tokens.includes('shift');
  const wantsAlt = tokens.includes('alt') || tokens.includes('option');
  const wantsCommandOrControl =
    tokens.includes('commandorcontrol') || tokens.includes('cmdorctrl');
  const wantsControl =
    tokens.includes('control') || tokens.includes('ctrl') || wantsCommandOrControl;
  const wantsCommand =
    tokens.includes('command') ||
    tokens.includes('cmd') ||
    tokens.includes('meta') ||
    wantsCommandOrControl;
  const keyToken = tokens.find(
    token =>
      ![
        'alt',
        'cmd',
        'cmdorctrl',
        'command',
        'commandorcontrol',
        'control',
        'ctrl',
        'meta',
        'option',
        'shift',
      ].includes(token),
  );

  if (!keyToken || normalizeKey(event.key) !== keyToken) {
    return false;
  }
  if (event.shiftKey !== wantsShift || event.altKey !== wantsAlt) {
    return false;
  }

  if (wantsCommandOrControl) {
    return event.ctrlKey || event.metaKey;
  }

  return event.ctrlKey === wantsControl && event.metaKey === wantsCommand;
};
