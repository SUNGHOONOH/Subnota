import { addDays, endOfWeek, format, isToday, isYesterday, startOfDay, startOfWeek } from 'date-fns';

export const formatMemoDate = (value: string) => {
  const date = new Date(value);

  if (isToday(date)) {
    return format(date, 'a h:mm');
  }

  if (isYesterday(date)) {
    return '어제';
  }

  return format(date, 'yyyy. M. d.');
};

export const formatBriefingDate = (value: string | null, fallback: string) => {
  if (value) {
    return format(new Date(`${value}T00:00:00`), 'M월 d일');
  }

  return format(new Date(fallback), 'M월 d일');
};

export const getWeekDates = (anchor: Date) => {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });

  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const getWeekRange = (anchor: Date) => {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });

  return { end, start };
};

export const getWeekLabel = (anchor: Date) => {
  const monthStart = startOfDay(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const currentWeekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekNumber =
    Math.floor((currentWeekStart.getTime() - firstWeekStart.getTime()) / 604800000) + 1;

  return `${format(anchor, 'M월')} ${weekNumber}주차`;
};
