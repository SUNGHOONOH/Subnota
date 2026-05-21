import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isBefore,
  startOfDay,
} from 'date-fns';

export type DateMatchKind =
  | 'relative'
  | 'numeric-date'
  | 'weekday'
  | 'month-day-kr'
  | 'short-date'
  | 'n-days-later'
  | 'weekend';

export interface DateMatch {
  text: string;
  date: Date;
  index: number;
  length: number;
  kind: DateMatchKind;
}

// ── Regex patterns ──────────────────────────────────────────────

// Full numeric: YY.MM.DD, YYYY.MM.DD, YY/MM/DD, YYYY-MM-DD
const NUMERIC_DATE_REGEX =
  /(?<!\d)(\d{2}|\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)/g;

// Relative dates (longer tokens first to avoid partial match)
const RELATIVE_DATE_REGEX = /내일\s*모레|오늘|내일|모레|글피|어제|엊그제|낼모레|낼/g;

// N일 후 / N일 뒤
const N_DAYS_LATER_REGEX = /(하루|이틀|사흘|나흘|(?:\d{1,3})일|(?:\d{1,2})주|(?:\d{1,2})달|(?:\d{1,2})개월)\s*(후|뒤|뒤에|후에)/g;

// Weekday with optional 이번주/다음주 prefix
const WEEKDAY_REGEX =
  /(?<![가-힣\d])(이번\s*주|다음\s*주|다다음\s*주|이번주|다음주|다다음주|담주)?\s*(일요일|월요일|화요일|수요일|목요일|금요일|토요일|일욜|월욜|화욜|수욜|목욜|금욜|토욜|일|월|화|수|목|금|토)(?![가-힣])/g;

// Weekend: 이번 주말, 다음 주말
const WEEKEND_REGEX = /(이번|다음|다다음)\s*주말/g;

// Korean month-day: N월 N일 or (이번 달|다음 달) N일
const MONTH_DAY_KR_REGEX =
  /(?:(이번\s*달|다음\s*달|다다음\s*달|이번달|다음달|다다음달)\s*(\d{1,2})일|(\d{1,2})월\s*(\d{1,2})일)/g;

// Short date without year: M.D or MM.DD (must not be part of Y.M.D)
const SHORT_DATE_REGEX =
  /(?<!\d[./-])(?<!\d)(\d{1,2})[./-](\d{1,2})(?![./-]\d)(?!\d)/g;

// Time expression that may follow a date token
const TIME_AFTER_REGEX =
  /^\s*(오전|오후|아침|점심|저녁|낮|밤|새벽)?\s*(\d{1,2})(?:(?::|시\s*)(\d{1,2})?)?\s*(반)?(?:\s*분)?/;

// ── Lookup tables ───────────────────────────────────────────────

const WEEKDAY_INDEX: Record<string, number> = {
  일요일: 0,
  일욜: 0,
  일: 0,
  월요일: 1,
  월욜: 1,
  월: 1,
  화요일: 2,
  화욜: 2,
  화: 2,
  수요일: 3,
  수욜: 3,
  수: 3,
  목요일: 4,
  목욜: 4,
  목: 4,
  금요일: 5,
  금욜: 5,
  금: 5,
  토요일: 6,
  토욜: 6,
  토: 6,
};

const RELATIVE_DAYS: Record<string, number> = {
  엊그제: -2,
  어제: -1,
  오늘: 0,
  내일: 1,
  낼: 1,
  모레: 2,
  내일모레: 2,
  '내일 모레': 2,
  낼모레: 2,
  글피: 3,
};

// ── Helpers ─────────────────────────────────────────────────────

const buildFullDate = (year: string, month: string, day: string) => {
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  const monthIndex = Number(month) - 1;
  const dayOfMonth = Number(day);
  const date = new Date(fullYear, monthIndex, dayOfMonth);

  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== dayOfMonth
  ) {
    return null;
  }

  return date;
};

const buildMonthDayDate = (month: number, day: number, baseDate: Date) => {
  const year = baseDate.getFullYear();
  const date = new Date(year, month - 1, day);

  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  if (isBefore(date, startOfDay(baseDate))) {
    date.setFullYear(year + 1);
  }

  return date;
};

const buildWeekdayDate = (
  weekdayText: string,
  baseDate: Date,
  prefix?: string,
) => {
  const today = startOfDay(baseDate);
  const targetDay = WEEKDAY_INDEX[weekdayText];
  const currentDay = today.getDay();

  if (targetDay === undefined) {
    return null;
  }

  let dayDelta = (targetDay - currentDay + 7) % 7;

  const normalizedPrefix = prefix?.replace(/\s/g, '');
  if (normalizedPrefix === '다음주' || normalizedPrefix === '담주') {
    dayDelta = dayDelta === 0 ? 7 : dayDelta + 7;
  } else if (normalizedPrefix === '다다음주') {
    dayDelta = dayDelta === 0 ? 14 : dayDelta + 14;
  }

  return addDays(today, dayDelta);
};

const buildWeekendDate = (prefix: string, baseDate: Date) => {
  const today = startOfDay(baseDate);
  const currentDay = today.getDay();
  // Saturday
  let dayDelta = (6 - currentDay + 7) % 7;

  const normalizedPrefix = prefix.replace(/\s/g, '');
  if (normalizedPrefix === '다음') {
    dayDelta += 7;
  } else if (normalizedPrefix === '다다음') {
    dayDelta += 14;
  }

  if (dayDelta === 0) {
    dayDelta = 7;
  }

  return addDays(today, dayDelta);
};

const withParsedTime = (
  text: string,
  date: Date,
  matchIndex: number,
  matchLength: number,
) => {
  const remainingText = text.slice(matchIndex + matchLength);
  const timeMatch = TIME_AFTER_REGEX.exec(remainingText);

  if (!timeMatch || !timeMatch[0].trim()) {
    return { date, length: matchLength };
  }

  let hour = Number(timeMatch[2]);
  const isHalf = timeMatch[4] === '반';
  const minute = isHalf ? 30 : timeMatch[3] ? Number(timeMatch[3]) : 0;

  if (hour > 24 || minute > 59) {
    return { date, length: matchLength };
  }

  const ampm = timeMatch[1];
  if (ampm) {
    if (['오후', '저녁', '밤'].includes(ampm) && hour < 12) {
      hour += 12;
    } else if (['오전', '아침', '새벽'].includes(ampm) && hour === 12) {
      hour = 0;
    } else if (ampm === '낮' && hour < 8) {
      hour += 12;
    }
  }

  if (hour === 24 && minute !== 0) {
    return { date, length: matchLength };
  }

  const scheduledDate = new Date(date);
  scheduledDate.setHours(hour === 24 ? 0 : hour, minute, 0, 0);

  return {
    date: scheduledDate,
    length: matchLength + timeMatch[0].length,
  };
};

// ── Main parser ─────────────────────────────────────────────────

export const parseDates = (
  text: string,
  baseTimestamp = Date.now(),
): DateMatch[] => {
  const matches: DateMatch[] = [];
  const baseDate = startOfDay(new Date(baseTimestamp));

  // 1. Full numeric dates: 26.03.06, 2026.03.06
  NUMERIC_DATE_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMERIC_DATE_REGEX.exec(text)) !== null) {
    const date = buildFullDate(m[1], m[2], m[3]);
    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'numeric-date',
      });
    }
  }

  // 2. Korean month-day: 3월 6일, 이번 달 15일, 다음 달 1일
  MONTH_DAY_KR_REGEX.lastIndex = 0;
  while ((m = MONTH_DAY_KR_REGEX.exec(text)) !== null) {
    let date: Date | null = null;

    if (m[1]) {
      // 이번 달 / 다음 달 N일
      const day = Number(m[2]);
      const normalizedPrefix = m[1].replace(/\s/g, '');
      let targetMonth = baseDate;
      if (normalizedPrefix === '다음달') {
        targetMonth = addMonths(baseDate, 1);
      } else if (normalizedPrefix === '다다음달') {
        targetMonth = addMonths(baseDate, 2);
      }
      date = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
      if (date.getDate() !== day) {
        date = null;
      }
    } else {
      // N월 N일
      const month = Number(m[3]);
      const day = Number(m[4]);
      date = buildMonthDayDate(month, day, baseDate);
    }

    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'month-day-kr',
      });
    }
  }

  // 3. Relative dates: 오늘, 내일, 모레, 글피, 내일모레
  RELATIVE_DATE_REGEX.lastIndex = 0;
  while ((m = RELATIVE_DATE_REGEX.exec(text)) !== null) {
    const delta = RELATIVE_DAYS[m[0]];
    if (delta === undefined) {
      continue;
    }
    const date = addDays(baseDate, delta);
    const scheduled = withParsedTime(text, date, m.index, m[0].length);
    matches.push({
      text: text.slice(m.index, m.index + scheduled.length),
      date: scheduled.date,
      index: m.index,
      length: scheduled.length,
      kind: 'relative',
    });
  }

  // 4. N일 후 / N일 뒤
  N_DAYS_LATER_REGEX.lastIndex = 0;
  while ((m = N_DAYS_LATER_REGEX.exec(text)) !== null) {
    const val = m[1];
    let targetDate: Date;

    if (val.endsWith('달') || val.endsWith('개월')) {
      const months = Number(val.replace(/달|개월/, ''));
      targetDate = addMonths(baseDate, months);
    } else {
      let n = 0;
      if (val === '하루') n = 1;
      else if (val === '이틀') n = 2;
      else if (val === '사흘') n = 3;
      else if (val === '나흘') n = 4;
      else if (val.endsWith('주')) n = Number(val.replace('주', '')) * 7;
      else n = Number(val.replace('일', ''));

      if (n > 365) continue;
      targetDate = addDays(baseDate, n);
    }

    const scheduled = withParsedTime(text, targetDate, m.index, m[0].length);
    matches.push({
      text: text.slice(m.index, m.index + scheduled.length),
      date: scheduled.date,
      index: m.index,
      length: scheduled.length,
      kind: 'n-days-later',
    });
  }

  // 5. Weekday: 월, 화요일, 이번 주 금, 다음 주 월요일
  WEEKDAY_REGEX.lastIndex = 0;
  while ((m = WEEKDAY_REGEX.exec(text)) !== null) {
    const date = buildWeekdayDate(m[2], baseDate, m[1]);
    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'weekday',
      });
    }
  }

  // 6. Weekend: 이번 주말, 다음 주말
  WEEKEND_REGEX.lastIndex = 0;
  while ((m = WEEKEND_REGEX.exec(text)) !== null) {
    const date = buildWeekendDate(m[1], baseDate);
    const scheduled = withParsedTime(text, date, m.index, m[0].length);
    matches.push({
      text: text.slice(m.index, m.index + scheduled.length),
      date: scheduled.date,
      index: m.index,
      length: scheduled.length,
      kind: 'weekend',
    });
  }

  // 7. Short date without year: 3.6, 03.06
  SHORT_DATE_REGEX.lastIndex = 0;
  while ((m = SHORT_DATE_REGEX.exec(text)) !== null) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      continue;
    }
    const date = buildMonthDayDate(month, day, baseDate);
    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'short-date',
      });
    }
  }

  // Sort by position and remove overlaps
  return matches
    .sort((a, b) => a.index - b.index)
    .filter((match, index, sorted) => {
      const previous = sorted[index - 1];
      return !previous || match.index >= previous.index + previous.length;
    });
};

// ── Display helpers ─────────────────────────────────────────────

export const findNearestDateMatch = (
  matches: DateMatch[],
  cursorIndex: number,
) => {
  if (matches.length === 0) {
    return null;
  }

  return matches.reduce<DateMatch | null>((nearest, match) => {
    const matchEnd = match.index + match.length;
    const distance =
      cursorIndex >= match.index && cursorIndex <= matchEnd
        ? 0
        : Math.min(
            Math.abs(cursorIndex - match.index),
            Math.abs(cursorIndex - matchEnd),
          );

    if (!nearest) {
      return match;
    }

    const nearestEnd = nearest.index + nearest.length;
    const nearestDistance =
      cursorIndex >= nearest.index && cursorIndex <= nearestEnd
        ? 0
        : Math.min(
            Math.abs(cursorIndex - nearest.index),
            Math.abs(cursorIndex - nearestEnd),
          );

    return distance < nearestDistance ? match : nearest;
  }, null);
};

export const formatDisplayDate = (date: Date): string => {
  return format(date, 'yyyy.MM.dd');
};

export const formatRelativeDisplayDate = (
  date: Date,
  baseTimestamp = Date.now(),
): string => {
  const diff = differenceInCalendarDays(
    date,
    startOfDay(new Date(baseTimestamp)),
  );

  if (diff === 0) {
    return `오늘 ${formatDisplayDate(date)}`;
  }

  if (diff === 1) {
    return `내일 ${formatDisplayDate(date)}`;
  }

  if (diff === 2) {
    return `모레 ${formatDisplayDate(date)}`;
  }

  return formatDisplayDate(date);
};

export const formatTimeIfPresent = (date: Date): string | null => {
  const h = date.getHours();
  const m = date.getMinutes();
  if (h === 0 && m === 0) {
    return null;
  }
  return format(date, 'HH:mm');
};
