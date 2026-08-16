import type { CalendarCategoryRow } from '../../types';

export const DEFAULT_CALENDAR_COLOR = '#66705A';

export const CALENDAR_COLOR_PRESETS = [
  { color: DEFAULT_CALENDAR_COLOR, label: '초록', labelEn: 'Green' },
  { color: '#2E8FE5', label: '파랑', labelEn: 'Blue' },
  { color: '#7650E6', label: '보라', labelEn: 'Purple' },
  { color: '#E24782', label: '분홍', labelEn: 'Pink' },
  { color: '#FF5357', label: '빨강', labelEn: 'Red' },
  { color: '#FFB31A', label: '노랑', labelEn: 'Yellow' },
] as const;

const CALENDAR_CATEGORIES_STORAGE_KEY = 'subnota.calendarCategories.v1';

const categoriesKey = (ownerId: string | null) =>
  `${CALENDAR_CATEGORIES_STORAGE_KEY}.${ownerId ? `user.${ownerId}` : 'guest'}`;

export const loadCalendarCategories = (
  ownerId: string | null,
): CalendarCategoryRow[] => {
  try {
    const raw = window.localStorage?.getItem(categoriesKey(ownerId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is CalendarCategoryRow =>
        Boolean(
          value &&
          typeof value === 'object' &&
          typeof (value as CalendarCategoryRow).id === 'string' &&
          typeof (value as CalendarCategoryRow).name === 'string' &&
          typeof (value as CalendarCategoryRow).color === 'string',
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } catch {
    return [];
  }
};

// ponytail: categories stay local to the signed-in device. Sync them only if
// users ask to share calendar category names across devices.
export const saveCalendarCategories = (
  ownerId: string | null,
  categories: CalendarCategoryRow[],
) => {
  try {
    window.localStorage?.setItem(
      categoriesKey(ownerId),
      JSON.stringify(categories),
    );
  } catch {
    // The current session remains usable when localStorage is unavailable.
  }
};
