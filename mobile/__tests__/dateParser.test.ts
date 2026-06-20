import { parseDates } from '../src/lib/dateParser';

const BASE_TIME = new Date('2026-06-03T09:00:00+09:00').getTime();

const firstDateKey = (text: string) => {
  const match = parseDates(text, BASE_TIME)[0];
  if (!match) {
    return null;
  }

  const year = match.date.getFullYear();
  const month = `${match.date.getMonth() + 1}`.padStart(2, '0');
  const day = `${match.date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const firstTime = (text: string) => {
  const match = parseDates(text, BASE_TIME)[0];
  if (!match) {
    return null;
  }

  const hour = `${match.date.getHours()}`.padStart(2, '0');
  const minute = `${match.date.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
};

describe('parseDates', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses ko-date-parse as the first pass for common Korean expressions', () => {
    const match = parseDates('내일 10시 회의', BASE_TIME)[0];

    expect(match).toMatchObject({
      text: '내일 10시',
      kind: 'ko-date-parse',
    });
    expect(firstDateKey('내일 10시 회의')).toBe('2026-06-04');
    expect(firstTime('내일 10시 회의')).toBe('10:00');
  });

  it('keeps Subnota fallback rules for realistic memo exceptions', () => {
    expect(firstDateKey('26.03.06 회고')).toBe('2026-03-06');
    expect(firstDateKey('다다음주 월요일 제품 회의')).toBe('2026-06-15');
    expect(firstDateKey('다음 달 5일 정리')).toBe('2026-07-05');
    expect(firstDateKey('주말에 방 정리')).toBe('2026-06-06');
    expect(firstTime('금요일 9시 반 운동')).toBe('09:30');
  });

  it('finds multiple date anchors in ordinary note text', () => {
    const matches = parseDates(
      '오늘 오후 3시 병원, 모레 저녁 약속, 6월 10일 회고',
      BASE_TIME,
    );

    expect(matches.map(match => match.text)).toEqual([
      '오늘 오후 3시',
      '모레 저녁',
      '6월 10일',
    ]);
    expect(matches.map(match => match.kind)).toEqual([
      'ko-date-parse',
      'ko-date-parse',
      'month-day-kr',
    ]);
  });

  it('recognizes Korean time periods after relative dates', () => {
    expect(firstTime('내일 아침 조깅')).toBe('09:00');
    expect(firstTime('내일 점심 약속')).toBe('12:00');
    expect(firstTime('내일 저녁 농구')).toBe('18:00');
  });

  it('recognizes this week and next week phrases', () => {
    expect(firstDateKey('이번주 토요일 책 정리')).toBe('2026-06-06');
    expect(firstDateKey('다음주 월요일 제품 회의')).toBe('2026-06-08');
    expect(firstDateKey('다음 주말 캠핑')).toBe('2026-06-13');
  });
});
