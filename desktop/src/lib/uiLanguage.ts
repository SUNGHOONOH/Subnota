import { useEffect, useState } from 'react';

import {
  APP_SETTINGS_CHANGED_EVENT,
  APP_SETTINGS_STORAGE_KEY,
  detectUiLanguage,
  loadAppSettings,
  UiLanguage,
} from './appSettings';

export const localize = (
  language: UiLanguage,
  korean: string,
  english: string,
) => (language === 'en' ? english : korean);

export type NumericDateOrder = 'mdy' | 'dmy' | 'ymd' | null;

const getSystemRegion = (locale: string) =>
  locale.match(/[-_]([A-Za-z]{2}|\d{3})(?:[-_]|$)/)?.[1]?.toUpperCase() ?? null;

const getSystemLocale = () => {
  if (typeof navigator === 'undefined') return '';

  // Prefer a locale that actually includes a region. Chromium can expose a
  // language-only first preference (for example `en`) while a later system
  // preference still carries the device country (`en-GB`).
  const locales = [...(navigator.languages ?? []), navigator.language].filter(
    (locale): locale is string => Boolean(locale),
  );
  return (
    locales.find(locale => getSystemRegion(locale)) ??
    locales[0] ??
    Intl.DateTimeFormat().resolvedOptions().locale ??
    ''
  );
};

export const getUiDateLocale = (language: UiLanguage) => {
  if (language === 'ko') return 'ko-KR';

  const systemLocale = getSystemLocale();
  if (systemLocale.toLowerCase().startsWith('en-')) return systemLocale;

  // Keep the device region even when the user chose English on a non-English
  // system (for example, English UI on a Korean or German device). Intl/CLDR
  // then supplies that region's date ordering instead of silently assuming US.
  const region = getSystemRegion(systemLocale);
  return region ? `en-${region}` : 'en-US';
};

export const getUiNumericDateOrder = (language: UiLanguage): NumericDateOrder => {
  if (language === 'ko') return 'mdy';

  try {
    const parts = new Intl.DateTimeFormat(getUiDateLocale(language), {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
      .formatToParts(new Date(2031, 10, 22))
      .filter(part => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map(part => part.type);

    const firstTwo = parts.slice(0, 2).join('-');
    if (firstTwo === 'month-day') return 'mdy';
    if (firstTwo === 'day-month') return 'dmy';
    if (firstTwo === 'year-month' || firstTwo === 'year-day') return 'ymd';
  } catch {
    // An unavailable/invalid locale is ambiguous; do not guess.
  }

  return null;
};

export const useUiLanguage = () => {
  const [language, setLanguage] = useState<UiLanguage>(() =>
    typeof window === 'undefined' ? detectUiLanguage() : loadAppSettings().uiLanguage,
  );

  useEffect(() => {
    const updateLanguage = () => setLanguage(loadAppSettings().uiLanguage);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === APP_SETTINGS_STORAGE_KEY) updateLanguage();
    };

    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, updateLanguage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, updateLanguage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return language;
};
