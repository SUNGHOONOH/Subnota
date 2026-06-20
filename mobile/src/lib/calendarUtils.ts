import { addDays, startOfMonth, startOfToday } from 'date-fns';

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const getNearestUpcomingDateForDay = (day: number) => {
  const today = startOfToday();
  const delta = (day - today.getDay() + 7) % 7;

  return addDays(today, delta).getTime();
};

export const getDateForWeekDay = (weekStart: Date, day: number) => {
  return addDays(weekStart, day).getTime();
};

export const getWeekOfMonth = (date: Date) => {
  const monthStartDay = startOfMonth(date).getDay();

  return Math.ceil((date.getDate() + monthStartDay) / 7);
};

export const normalizeTime = (hour: string, minute: string) => {
  if (!hour.trim()) {
    return null;
  }

  const h = parseInt(hour, 10);
  const m = minute.trim() ? parseInt(minute, 10) : 0;

  if (
    Number.isNaN(h) ||
    h < 0 ||
    h > 23 ||
    Number.isNaN(m) ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
