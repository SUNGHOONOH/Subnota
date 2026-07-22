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
  | 'day-only';

export interface DateMatch {
  text: string;
  date: Date;
  index: number;
  length: number;
  kind: DateMatchKind;
  // 시각 표현("3시", "15:30")까지 인식됐는지. allDay 판정은 이 플래그를 쓴다 —
  // date가 00:00이라는 것만으로는 "24:00 → 익일 자정" 일정과 구분할 수 없다.
  hasTime: boolean;
}

// ── Regex patterns ──────────────────────────────────────────────

// Full numeric: YY.MM.DD, YYYY.MM.DD, YY/MM/DD, YYYY-MM-DD
const NUMERIC_DATE_REGEX =
  /(?<!\d)(\d{2}|\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)/g;

// Relative dates (longer tokens first to avoid partial match).
// 낼(내일 준말)은 "보낼/끝낼/낼게" 같은 동사 활용형과 겹쳐 오탐이 많아 제외한다.
const RELATIVE_DATE_REGEX = /내일\s*모레|오늘|내일|모레|글피|어제|엊그제|그저께/g;

// N일 후 / N일 뒤. 순우리말 셈(열흘·보름…)과 일주일/이주일도 포함한다.
// 모두 후/뒤가 붙어야만 매칭되므로 일반 명사와 겹칠 위험이 없다.
const N_DAYS_LATER_REGEX =
  /(하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레|열흘|보름|스무날|일주일|이주일|삼주일|사주일|(?:\d{1,3})일|(?:\d{1,2})주|(?:\d{1,2})달|(?:\d{1,2})개월)\s*(후|뒤|뒤에|후에)/g;

// Weekday with optional 이번주/다음주/지난주 prefix. 지난주·저번주는 과거를
// 가리키므로 buildWeekdayDate에서 매치를 버린다(미래로 오인 방지).
// 뒤 조사("월요일까지/화요일에")는 허용하되, 다른 단어에 붙은 경우("월급")는
// 막는다: 요일 뒤 한글이 흔한 조사로 시작할 때만 통과시킨다.
const WEEKDAY_REGEX =
  /(?<![가-힣\d])(이번\s*주|다음\s*주|다다음\s*주|지난\s*주|저번\s*주|이번주|다음주|다다음주|지난주|저번주|담주)?\s*(일요일|월요일|화요일|수요일|목요일|금요일|토요일|일욜|월욜|화욜|수욜|목욜|금욜|토욜|일|월|화|수|목|금|토)(?!(?!에|엔|은|는|이|가|을|를|도|만|까|부|께|경|쯤|날|마|밖)[가-힣])/g;

// 주말은 토/일 어느 날인지 특정할 수 없어(모호) 인식하지 않는다.

// Bare day-of-month: 24일 (월 없이 일자만). 앞에 숫자가 있으면(연·월의 일부)
// 제외하고, 뒤에 기간·순번 표현이 오면 날짜가 아니므로 제외한다.
// ponytail: 기간어 목록(정도/만/동안…)은 대표 케이스만 막는 한계가 있음.
const BARE_DAY_REGEX =
  /(?<!\d)(?<!월\s?)(\d{1,2})일(?!\s*(?:후|뒤|동안|정도|만|가량|째))(?![간째차치만\d])/g;

// Korean month-day: N월 N일 or (이번 달|다음 달) N일
const MONTH_DAY_KR_REGEX =
  /(?:(이번\s*달|다음\s*달|다다음\s*달|이번달|다음달|다다음달)\s*(\d{1,2})일|(\d{1,2})월\s*(\d{1,2})일)/g;

// Year-explicit Korean date: 2025년 7월 20일
const YEAR_MONTH_DAY_KR_REGEX = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;

// Short date without year: 슬래시 형식만 (M/D). 점 형식(3.6)은 소수·버전·수치와
// 구분이 불가능해 제외한다. 연도 포함 점 형식(26.3.6)은 NUMERIC_DATE_REGEX가 잡는다.
const SHORT_DATE_REGEX = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g;

// Time expression that may follow a date token. 맨 숫자("내일 100개")를
// 시각으로 오인하지 않도록 시 / : 표지를 요구한다.
// "3시간"의 시(時)는 시각이 아니므로 시(?!간)으로 제외한다.
const TIME_AFTER_REGEX =
  /^\s*(오전|오후|아침|점심|저녁|낮|밤|새벽)?\s*(\d{1,2})(?:시(?!간)(?:\s*(\d{1,2})(?:\s*분)?|\s*(반))?|:(\d{1,2}))(?!\d)/;

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
  그저께: -2,
  엊그제: -2,
  어제: -1,
  오늘: 0,
  내일: 1,
  모레: 2,
  내일모레: 2,
  '내일 모레': 2,
  글피: 3,
};

// 순우리말 날 셈: "열흘 뒤", "보름 후" 등. 후/뒤와만 결합해 쓰인다.
const NATIVE_DAY_COUNTS: Record<string, number> = {
  하루: 1,
  이틀: 2,
  사흘: 3,
  나흘: 4,
  닷새: 5,
  엿새: 6,
  이레: 7,
  여드레: 8,
  아흐레: 9,
  열흘: 10,
  보름: 15,
  스무날: 20,
  일주일: 7,
  이주일: 14,
  삼주일: 21,
  사주일: 28,
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
    // 내년으로 넘길 때 2월 29일이 3월 1일로 밀리는 것을 막는다.
    const nextYear = new Date(year + 1, month - 1, day);
    if (nextYear.getMonth() !== month - 1 || nextYear.getDate() !== day) {
      return null;
    }
    return nextYear;
  }

  return date;
};

// 월 없는 단독 일자(24일): 이번 달 N일. 오늘 날짜 이하(당일 포함)면 다음 달로
// 넘긴다("오늘 마감"은 보통 "오늘"이라 쓰므로 지난 것으로 간주). 대상 달에 그
// 날이 없으면(2월 30일 등) 무효.
const buildBareDayDate = (day: number, baseDate: Date) => {
  const base = startOfDay(baseDate);
  const target =
    day <= base.getDate()
      ? new Date(base.getFullYear(), base.getMonth() + 1, day)
      : new Date(base.getFullYear(), base.getMonth(), day);

  return target.getDate() === day ? target : null;
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

  const normalizedPrefix = prefix?.replace(/\s/g, '');
  // 과거 방향은 미래 날짜로 오인하지 않도록 인식에서 제외한다.
  if (normalizedPrefix === '지난주' || normalizedPrefix === '저번주') {
    return null;
  }

  let dayDelta = (targetDay - currentDay + 7) % 7;

  if (normalizedPrefix === '다음주' || normalizedPrefix === '담주') {
    dayDelta = dayDelta === 0 ? 7 : dayDelta + 7;
  } else if (normalizedPrefix === '다다음주') {
    dayDelta = dayDelta === 0 ? 14 : dayDelta + 14;
  } else if (!normalizedPrefix && dayDelta === 0) {
    // 접두사 없는 단독 요일이 오늘 요일과 같으면 돌아오는 다음 주로 본다.
    // ("이번 주 수요일"처럼 접두사가 있으면 오늘 그대로.)
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

  if (!timeMatch) {
    return { date, length: matchLength, hasTime: false };
  }

  let hour = Number(timeMatch[2]);
  const isHalf = timeMatch[4] === '반';
  const minuteText = timeMatch[3] ?? timeMatch[5];
  const minute = isHalf ? 30 : minuteText ? Number(minuteText) : 0;

  if (hour > 24 || minute > 59) {
    return { date, length: matchLength, hasTime: false };
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
  } else if (hour >= 1 && hour <= 5) {
    hour += 12;
  }

  if (hour === 24 && minute !== 0) {
    return { date, length: matchLength, hasTime: false };
  }

  const scheduledDate = new Date(date);
  if (hour === 24) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }
  scheduledDate.setHours(hour === 24 ? 0 : hour, minute, 0, 0);

  return {
    date: scheduledDate,
    length: matchLength + timeMatch[0].length,
    hasTime: true,
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
        hasTime: scheduled.hasTime,
      });
    }
  }

  // 1-1. Year-explicit Korean dates: 2025년 7월 20일 — 연도가 명시되면 그대로
  // 존중한다. (겹치는 "7월 20일" month-day 매치는 overlap 필터가 걸러낸다.)
  YEAR_MONTH_DAY_KR_REGEX.lastIndex = 0;
  while ((m = YEAR_MONTH_DAY_KR_REGEX.exec(text)) !== null) {
    const date = buildFullDate(m[1], m[2], m[3]);
    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'numeric-date',
        hasTime: scheduled.hasTime,
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
        hasTime: scheduled.hasTime,
      });
    }
  }

  // 3. Relative dates: 오늘, 내일, 모레, 글피, 내일모레
  RELATIVE_DATE_REGEX.lastIndex = 0;
  while ((m = RELATIVE_DATE_REGEX.exec(text)) !== null) {
    const delta =
      RELATIVE_DAYS[m[0]] ?? RELATIVE_DAYS[m[0].replace(/\s+/g, '')];
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
      hasTime: scheduled.hasTime,
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
      let n: number;
      if (NATIVE_DAY_COUNTS[val] !== undefined) {
        n = NATIVE_DAY_COUNTS[val];
      } else if (val.endsWith('주')) {
        n = Number(val.replace('주', '')) * 7;
      } else {
        n = Number(val.replace('일', ''));
      }

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
      hasTime: scheduled.hasTime,
    });
  }

  // 5. Weekday: 월요일, 이번 주 금, 다음 주 월
  WEEKDAY_REGEX.lastIndex = 0;
  while ((m = WEEKDAY_REGEX.exec(text)) !== null) {
    // 접두사 없는 한 글자("일 시작", "금 시세")는 요일보다 일반 명사일
    // 가능성이 높아 제외한다. "다음주 월", "월요일", "월욜"은 그대로 인식.
    if (!m[1] && m[2].length === 1) {
      continue;
    }
    const date = buildWeekdayDate(m[2], baseDate, m[1]);
    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'weekday',
        hasTime: scheduled.hasTime,
      });
    }
  }

  // 6. Short date without year: 3/6, 12/25
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
        hasTime: scheduled.hasTime,
      });
    }
  }

  // 7. Bare day-of-month: 24일 (월 없이). month-day/n-days-later와 겹치면
  // overlap 필터가 정리하므로 뒤에 둔다.
  BARE_DAY_REGEX.lastIndex = 0;
  while ((m = BARE_DAY_REGEX.exec(text)) !== null) {
    const day = Number(m[1]);
    if (day < 1 || day > 31) {
      continue;
    }
    const date = buildBareDayDate(day, baseDate);
    if (date) {
      const scheduled = withParsedTime(text, date, m.index, m[0].length);
      matches.push({
        text: text.slice(m.index, m.index + scheduled.length),
        date: scheduled.date,
        index: m.index,
        length: scheduled.length,
        kind: 'day-only',
        hasTime: scheduled.hasTime,
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
