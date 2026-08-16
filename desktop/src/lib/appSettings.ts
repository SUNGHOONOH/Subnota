export type CloseBehavior = 'quit' | 'tray';
export type UiLanguage = 'en' | 'ko';

export const APP_SETTINGS_CHANGED_EVENT = 'subnota:app-settings-changed';

export const detectUiLanguage = (): UiLanguage =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ko')
    ? 'ko'
    : 'en';

export interface AppSettings {
  ambientAutoSearchEnabled: boolean;
  autoCheckUpdates: boolean;
  /** 링크를 저장했을 때 OS 알림. 꺼도 메뉴바·트레이 표시는 남는다. */
  clipNotifications: boolean;
  fontSize: number;
  lineHeight: number;
  restoreWorkspace: boolean;
  uiLanguage: UiLanguage;
}

export const APP_SETTINGS_STORAGE_KEY = 'subnota.appSettings.v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ambientAutoSearchEnabled: true,
  autoCheckUpdates: true,
  clipNotifications: true,
  fontSize: 16,
  lineHeight: 1.7,
  restoreWorkspace: true,
  uiLanguage: detectUiLanguage(),
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const normalizeAppSettings = (
  value?: Partial<AppSettings> | null,
): AppSettings => ({
  ambientAutoSearchEnabled:
    typeof value?.ambientAutoSearchEnabled === 'boolean'
      ? value.ambientAutoSearchEnabled
      : DEFAULT_APP_SETTINGS.ambientAutoSearchEnabled,
  clipNotifications:
    typeof value?.clipNotifications === 'boolean'
      ? value.clipNotifications
      : DEFAULT_APP_SETTINGS.clipNotifications,
  autoCheckUpdates:
    typeof value?.autoCheckUpdates === 'boolean'
      ? value.autoCheckUpdates
      : DEFAULT_APP_SETTINGS.autoCheckUpdates,
  fontSize:
    typeof value?.fontSize === 'number'
      ? clamp(value.fontSize, 12, 24)
      : DEFAULT_APP_SETTINGS.fontSize,
  lineHeight:
    typeof value?.lineHeight === 'number'
      ? clamp(value.lineHeight, 1.2, 2.2)
      : DEFAULT_APP_SETTINGS.lineHeight,
  restoreWorkspace:
    typeof value?.restoreWorkspace === 'boolean'
      ? value.restoreWorkspace
      : DEFAULT_APP_SETTINGS.restoreWorkspace,
  uiLanguage:
    value?.uiLanguage === 'ko' || value?.uiLanguage === 'en'
      ? value.uiLanguage
      : DEFAULT_APP_SETTINGS.uiLanguage,
});

export const loadAppSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_APP_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    return raw
      ? normalizeAppSettings(JSON.parse(raw) as Partial<AppSettings>)
      : DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings) => {
  const normalized = normalizeAppSettings(settings);
  window.localStorage?.setItem(
    APP_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  applyEditorSettings(normalized);
  window.dispatchEvent(new Event(APP_SETTINGS_CHANGED_EVENT));
  return normalized;
};

export const applyEditorSettings = (settings: AppSettings) => {
  document.documentElement.lang = settings.uiLanguage;
  document.documentElement.style.setProperty(
    '--subnota-editor-font-size',
    `${settings.fontSize}px`,
  );
  document.documentElement.style.setProperty(
    '--subnota-editor-line-height',
    String(settings.lineHeight),
  );
};
