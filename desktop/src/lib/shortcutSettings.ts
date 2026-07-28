export interface ShortcutSettings {
  capturePage: string;
  openSearch: string;
  toggleMini: string;
}

export interface AppShortcutSettings {
  createMemo: string;
  openSettings: string;
  openMemos: string;
  openCalendar: string;
  openInbox: string;
  focusPreviousPane: string;
  focusNextPane: string;
  createSplitPane: string;
  openAmbientDetail: string;
  openAmbientList: string;
}

export interface GlobalShortcutRegistration {
  capture: boolean;
  toggle: boolean;
}

export interface GlobalShortcutUpdateResult {
  registered: GlobalShortcutRegistration;
  settings: ShortcutSettings;
}

// Bumped to v3 when page capture moved off ⌘⇧S (Save As in many apps) to ⌘⇧Y.
// Existing user-chosen shortcuts are preserved; only the old untouched default
// is migrated.
export const SHORTCUT_STORAGE_KEY = 'subnota.shortcuts.v3';
const LEGACY_SHORTCUT_STORAGE_KEY = 'subnota.shortcuts.v2';

const LEGACY_DEFAULT_SHORTCUT_SETTINGS: ShortcutSettings = {
  capturePage: 'Shift+CommandOrControl+S',
  openSearch: 'Shift+CommandOrControl+F',
  toggleMini: 'Alt+S',
};

export const DEFAULT_SHORTCUT_SETTINGS: ShortcutSettings = {
  capturePage: 'Shift+CommandOrControl+Y',
  openSearch: 'Shift+CommandOrControl+F',
  toggleMini: 'Alt+Y',
};

export const DEFAULT_APP_SHORTCUT_SETTINGS: AppShortcutSettings = {
  createMemo: 'CommandOrControl+N',
  openSettings: 'CommandOrControl+,',
  openMemos: 'CommandOrControl+1',
  openCalendar: 'CommandOrControl+2',
  openInbox: 'CommandOrControl+3',
  focusPreviousPane: 'CommandOrControl+Alt+Left',
  focusNextPane: 'CommandOrControl+Alt+Right',
  createSplitPane: 'CommandOrControl+\\',
  // ambient 추천은 에디터에 포커스가 있는 동안 뜬다. Tab은 Tiptap의 리스트
  // 들여쓰기와, 평범한 문자 키는 입력과 충돌하므로 수식 조합을 쓴다.
  openAmbientDetail: 'CommandOrControl+Enter',
  openAmbientList: 'CommandOrControl+Shift+Enter',
};

export const SHORTCUT_FIELDS = [
  'toggleMini',
  'capturePage',
  'openSearch',
] as const satisfies ReadonlyArray<keyof ShortcutSettings>;

// 충돌 안내 문구가 설정 화면과 Mini에서 같은 이름을 쓰도록 여기서 관리한다.
export const SHORTCUT_LABELS: Record<keyof ShortcutSettings, string> = {
  capturePage: '현재 페이지 저장',
  openSearch: '메모 검색',
  toggleMini: 'Mini Subnota 열기',
};

export const APP_SHORTCUT_LABELS: Record<keyof AppShortcutSettings, string> = {
  createMemo: '새 메모 생성',
  openSettings: '설정 열기',
  openMemos: '메모 보기',
  openCalendar: '캘린더 보기',
  openInbox: 'Inbox 보기',
  focusPreviousPane: '이전 분할 패널 포커스',
  focusNextPane: '다음 분할 패널 포커스',
  createSplitPane: '새 분할 패널',
  openAmbientDetail: '연결된 문장 미리보기',
  openAmbientList: '연결된 문장 목록',
};

/**
 * 액셀러레이터를 화면에 보여줄 짧은 문자열로. ambient 고스트 줄의 힌트처럼
 * 좁은 자리에 쓰므로 기호를 쓴다. macOS는 ⌘, 그 외는 Ctrl (design.md 규칙).
 */
export const formatHotkeyHint = (
  accelerator?: string | null,
  isMac: boolean = typeof navigator !== 'undefined' &&
    /Mac/i.test(navigator.platform),
): string => {
  if (!accelerator) return '';
  return accelerator
    .split('+')
    .map(key => {
      const part = key.trim();
      if (part === 'CommandOrControl' || part === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (part === 'Command' || part === 'Cmd') return '⌘';
      if (part === 'Control' || part === 'Ctrl') return 'Ctrl';
      if (part === 'Shift') return '⇧';
      if (part === 'Alt' || part === 'Option') return isMac ? '⌥' : 'Alt';
      if (part === 'Enter' || part === 'Return') return '↩';
      if (part === 'Plus') return '+';
      if (part === 'Comma') return ',';
      return part;
    })
    .join('');
};

export const APP_SHORTCUT_FIELDS = Object.keys(
  DEFAULT_APP_SHORTCUT_SETTINGS,
) as Array<keyof AppShortcutSettings>;
export const APP_SHORTCUT_STORAGE_KEY = 'subnota.app-shortcuts.v1';

const readShortcutValue = (
  value: unknown,
  fallback: string,
) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

export const normalizeShortcutSettings = (
  value?: Partial<ShortcutSettings> | null,
): ShortcutSettings => ({
  capturePage: readShortcutValue(
    value?.capturePage,
    DEFAULT_SHORTCUT_SETTINGS.capturePage,
  ),
  openSearch: readShortcutValue(
    value?.openSearch,
    DEFAULT_SHORTCUT_SETTINGS.openSearch,
  ),
  toggleMini: readShortcutValue(
    value?.toggleMini,
    DEFAULT_SHORTCUT_SETTINGS.toggleMini,
  ),
});

export const loadShortcutSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SHORTCUT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (raw) {
      return normalizeShortcutSettings(JSON.parse(raw) as Partial<ShortcutSettings>);
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_SHORTCUT_STORAGE_KEY);
    if (!legacyRaw) {
      return DEFAULT_SHORTCUT_SETTINGS;
    }

    const legacy = normalizeShortcutSettings(
      JSON.parse(legacyRaw) as Partial<ShortcutSettings>,
    );
    const migrated =
      JSON.stringify(legacy) === JSON.stringify(LEGACY_DEFAULT_SHORTCUT_SETTINGS)
        ? DEFAULT_SHORTCUT_SETTINGS
        : legacy;
    window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
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

const normalizeAppShortcutValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

export const normalizeAppShortcutSettings = (
  value?: Partial<AppShortcutSettings> | null,
): AppShortcutSettings => ({
  createMemo: normalizeAppShortcutValue(
    value?.createMemo,
    DEFAULT_APP_SHORTCUT_SETTINGS.createMemo,
  ),
  openSettings: normalizeAppShortcutValue(
    value?.openSettings,
    DEFAULT_APP_SHORTCUT_SETTINGS.openSettings,
  ),
  openMemos: normalizeAppShortcutValue(
    value?.openMemos,
    DEFAULT_APP_SHORTCUT_SETTINGS.openMemos,
  ),
  openCalendar: normalizeAppShortcutValue(
    value?.openCalendar,
    DEFAULT_APP_SHORTCUT_SETTINGS.openCalendar,
  ),
  openInbox: normalizeAppShortcutValue(
    value?.openInbox,
    DEFAULT_APP_SHORTCUT_SETTINGS.openInbox,
  ),
  openAmbientDetail: normalizeAppShortcutValue(
    value?.openAmbientDetail,
    DEFAULT_APP_SHORTCUT_SETTINGS.openAmbientDetail,
  ),
  openAmbientList: normalizeAppShortcutValue(
    value?.openAmbientList,
    DEFAULT_APP_SHORTCUT_SETTINGS.openAmbientList,
  ),
  focusPreviousPane: normalizeAppShortcutValue(
    value?.focusPreviousPane,
    DEFAULT_APP_SHORTCUT_SETTINGS.focusPreviousPane,
  ),
  focusNextPane: normalizeAppShortcutValue(
    value?.focusNextPane,
    DEFAULT_APP_SHORTCUT_SETTINGS.focusNextPane,
  ),
  createSplitPane: normalizeAppShortcutValue(
    value?.createSplitPane,
    DEFAULT_APP_SHORTCUT_SETTINGS.createSplitPane,
  ),
});

export const loadAppShortcutSettings = (): AppShortcutSettings => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_APP_SHORTCUT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(APP_SHORTCUT_STORAGE_KEY);
    return raw
      ? normalizeAppShortcutSettings(JSON.parse(raw) as Partial<AppShortcutSettings>)
      : DEFAULT_APP_SHORTCUT_SETTINGS;
  } catch {
    return DEFAULT_APP_SHORTCUT_SETTINGS;
  }
};

export const saveAppShortcutSettings = (settings: AppShortcutSettings) => {
  const normalized = normalizeAppShortcutSettings(settings);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(APP_SHORTCUT_STORAGE_KEY, JSON.stringify(normalized));
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
  // '+'를 그대로 두면 accelerator를 '+'로 쪼갤 때 키가 사라진다.
  if (key === '+') {
    return 'Plus';
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

const MODIFIER_TOKENS: Record<string, string> = {
  alt: 'Alt',
  cmd: 'Command',
  cmdorctrl: 'CommandOrControl',
  command: 'Command',
  commandorcontrol: 'CommandOrControl',
  control: 'Control',
  ctrl: 'Control',
  meta: 'Command',
  mod: 'CommandOrControl',
  option: 'Alt',
  shift: 'Shift',
};

const MODIFIER_ORDER = [
  'CommandOrControl',
  'Command',
  'Control',
  'Alt',
  'Shift',
];

const KEY_TOKENS: Record<string, string> = {
  ' ': 'Space',
  '+': 'Plus',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  arrowup: 'Up',
  down: 'Down',
  esc: 'Escape',
  escape: 'Escape',
  left: 'Left',
  plus: 'Plus',
  right: 'Right',
  space: 'Space',
  up: 'Up',
};

const canonicalKeyToken = (token: string) => {
  const alias = KEY_TOKENS[token.toLowerCase()];
  if (alias) {
    return alias;
  }
  if (token.length === 1) {
    return token.toUpperCase();
  }
  return token.charAt(0).toUpperCase() + token.slice(1);
};

// 표기가 달라도 같은 키 조합이면 같은 문자열이 되도록 정규화한다
// ('Shift+CommandOrControl+S' === 'CommandOrControl+Shift+S',
//  'mod+ArrowLeft' === 'CommandOrControl+Left').
// 중복 검사를 문자열 비교로 하려면 이게 전제다.
export const canonicalizeAccelerator = (accelerator: string): string | null => {
  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const raw of accelerator.split('+')) {
    const token = raw.trim();
    if (!token) {
      continue;
    }
    const modifier = MODIFIER_TOKENS[token.toLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    if (key) {
      // 키가 둘 이상인 문자열은 해석하지 않는다.
      return null;
    }
    key = canonicalKeyToken(token);
  }

  if (!key) {
    return null;
  }

  return [
    ...MODIFIER_ORDER.filter(modifier => modifiers.has(modifier)),
    key,
  ].join('+');
};

// Electron accelerator 표기를 Mantine useHotkeys 표기로 변환한다.
// 저장/OS 등록은 Electron 표기를 사용하지만, renderer 단축키 매처는
// `mod`, `ctrl`, `alt`, `shift` 토큰만 인식한다.
export const toMantineHotkey = (accelerator: string): string => {
  const tokens = accelerator
    .split('+')
    .map(token => token.trim())
    .filter(Boolean);

  return tokens
    .map(token => {
      const normalized = token.toLowerCase();
      if (normalized === 'commandorcontrol' || normalized === 'cmdorctrl') return 'mod';
      if (normalized === 'command' || normalized === 'cmd' || normalized === 'meta') return 'meta';
      if (normalized === 'control' || normalized === 'ctrl') return 'ctrl';
      if (normalized === 'option' || normalized === 'alt') return 'alt';
      if (normalized === 'shift') return 'shift';
      if (normalized === 'left' || normalized === 'arrowleft') return 'arrowleft';
      if (normalized === 'right' || normalized === 'arrowright') return 'arrowright';
      if (normalized === 'up' || normalized === 'arrowup') return 'arrowup';
      if (normalized === 'down' || normalized === 'arrowdown') return 'arrowdown';
      if (normalized === 'escape' || normalized === 'esc') return 'escape';
      if (normalized === 'space') return 'space';
      if (normalized === 'plus') return 'plus';
      return token.toLowerCase();
    })
    .join('+');
};

// 필드끼리의 중복과 앱 기본 단축키와의 충돌을 함께 본다.
// 반환값은 필드 → 충돌 상대 이름.
export const findShortcutConflictsForFields = (
  settings: Record<string, string>,
  options: {
    fields?: ReadonlyArray<string>;
    labels: Record<string, string>;
    reserved?: ReadonlyArray<{ accelerator: string; label: string }>;
  },
): Partial<Record<string, string>> => {
  const fields = options.fields ?? Object.keys(settings);
  const canonical = new Map<string, string>();

  for (const field of fields) {
    const value = canonicalizeAccelerator(settings[field]);
    if (value) {
      canonical.set(field, value);
    }
  }

  const conflicts: Partial<Record<string, string>> = {};

  for (const field of fields) {
    const value = canonical.get(field);
    if (!value) {
      continue;
    }

    const duplicate = fields.find(
      other => other !== field && canonical.get(other) === value,
    );
    if (duplicate) {
      conflicts[field] = options.labels[duplicate];
      continue;
    }

    const reserved = options.reserved?.find(
      item => canonicalizeAccelerator(item.accelerator) === value,
    );
    if (reserved) {
      conflicts[field] = reserved.label;
    }
  }

  return conflicts;
};

export const findShortcutConflicts = (
  settings: ShortcutSettings,
  options: {
    fields?: ReadonlyArray<keyof ShortcutSettings>;
    labels: Record<keyof ShortcutSettings, string>;
    reserved?: ReadonlyArray<{ accelerator: string; label: string }>;
  },
): Partial<Record<keyof ShortcutSettings, string>> =>
  findShortcutConflictsForFields(settings as unknown as Record<string, string>, options) as Partial<
    Record<keyof ShortcutSettings, string>
  >;

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
