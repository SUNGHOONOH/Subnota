import { describe, expect, it } from 'vitest';

import { parseDates } from '../lib/dateParser';

describe('date parser', () => {
  it('resolves 내일 to the day after the base date', () => {
    const base = new Date(2026, 6, 5, 14, 0, 0); // 2026-07-05
    const match = parseDates('내일 회의', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(6);
    expect(match.date.getDate()).toBe(6);
  });

  it('resolves 이틀 뒤 to two days after the base date', () => {
    const base = new Date(2026, 6, 5, 14, 0, 0); // 2026-07-05
    const match = parseDates('이틀 뒤 점검', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(6);
    expect(match.date.getDate()).toBe(7);
  });

  it('treats 24:00 as midnight of the following day', () => {
    const base = new Date(2026, 5, 22, 10, 0, 0);
    const match = parseDates('오늘 24:00', base.getTime())[0];

    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(5);
    expect(match.date.getDate()).toBe(23);
    expect(match.date.getHours()).toBe(0);
    expect(match.hasTime).toBe(true);
  });
});

describe('time recognition', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime(); // 2026-07-19 (일)

  it('시/: 표지가 있는 시각만 인식한다', () => {
    expect(parseDates('내일 3시 회의', base)[0]).toMatchObject({
      text: '내일 3시',
      hasTime: true,
    });
    expect(parseDates('내일 3시 회의', base)[0].date.getHours()).toBe(15);
    expect(parseDates('내일 15:30 회의', base)[0].date.getMinutes()).toBe(30);
    expect(parseDates('내일 3시 반', base)[0].date.getMinutes()).toBe(30);
    expect(parseDates('내일 3시 30분', base)[0].date.getMinutes()).toBe(30);
    expect(parseDates('내일 오후 3시', base)[0].date.getHours()).toBe(15);
  });

  it('날짜 뒤 맨 숫자를 시각으로 오인하지 않는다', () => {
    const match = parseDates('내일 100개 사기', base)[0];
    expect(match.text).toBe('내일');
    expect(match.hasTime).toBe(false);
    expect(match.date.getHours()).toBe(0);

    expect(parseDates('오늘 3만원 지출', base)[0].hasTime).toBe(false);
  });

  it('시간이 없으면 hasTime=false', () => {
    expect(parseDates('내일 회의', base)[0].hasTime).toBe(false);
  });

  it('N시간(기간)을 N시(시각)로 오인하지 않는다', () => {
    const match = parseDates('내일 3시간짜리 회의', base)[0];
    expect(match.text).toBe('내일');
    expect(match.hasTime).toBe(false);
  });
});

describe('false positives', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('낼(내일 준말)은 동사 활용형과 겹쳐 인식하지 않는다', () => {
    expect(parseDates('보고서 끝낼 것', base)).toHaveLength(0);
    expect(parseDates('메일 보낼 사람 정리', base)).toHaveLength(0);
    expect(parseDates('낼게', base)).toHaveLength(0);
    expect(parseDates('낼 3시에 보자', base)).toHaveLength(0);
  });

  it('주말은 특정일을 알 수 없어 인식하지 않는다', () => {
    expect(parseDates('주말에 청소', base)).toHaveLength(0);
    expect(parseDates('주말농장 알아보기', base)).toHaveLength(0);
    expect(parseDates('다음주 주말 여행', base)).toHaveLength(0);
  });

  it('접두사 없는 한 글자 요일은 제외한다', () => {
    expect(parseDates('일 시작하기', base)).toHaveLength(0);
    expect(parseDates('금 시세 확인', base)).toHaveLength(0);
  });

  it('접두사나 요일 접미사가 있으면 인식한다', () => {
    expect(parseDates('다음주 월', base)[0].date.getDay()).toBe(1);
    expect(parseDates('월요일 회의', base)[0].date.getDay()).toBe(1);
    expect(parseDates('금욜 약속', base)[0].date.getDay()).toBe(5);
  });

  it('지난·저번 방향은 미래로 오인하지 않는다', () => {
    expect(parseDates('저번주 화요일 메모', base)).toHaveLength(0);
    expect(parseDates('지난주 금요일 회의록', base)).toHaveLength(0);
  });
});

describe('weekday same-day rollover', () => {
  // 2026-07-19 = 일요일
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('단독 요일이 오늘 요일과 같으면 다음 주로 본다', () => {
    const match = parseDates('일요일 3시', base)[0];
    expect(match.date.getDate()).toBe(26); // 다음 주 일요일
    expect(match.date.getHours()).toBe(15);
  });

  it('접두사(이번 주)가 있으면 오늘 그대로', () => {
    const match = parseDates('이번 주 일요일', base)[0];
    expect(match.date.getDate()).toBe(19);
  });

  it('아직 안 지난 요일은 이번 주', () => {
    const match = parseDates('수요일 회의', base)[0];
    expect(match.date.getDate()).toBe(22); // 이번 주 수요일
  });
});

describe('short date (slash only)', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('슬래시 형식은 인식한다', () => {
    expect(parseDates('3/6 회의', base)[0].date.getMonth()).toBe(2);
    expect(parseDates('12/25 파티', base)[0]).toMatchObject({ text: '12/25' });
  });

  it('점 형식은 소수와 구분 불가라 인식하지 않는다', () => {
    expect(parseDates('3.6 회의', base)).toHaveLength(0);
    expect(parseDates('버전 1.5', base)).toHaveLength(0);
    expect(parseDates('진도 3.5', base)).toHaveLength(0);
    expect(parseDates('수익률 36.5', base)).toHaveLength(0);
  });

  it('연도 포함 점 형식은 numeric으로 유지된다', () => {
    const match = parseDates('26.3.6 발표', base)[0];
    expect(match.kind).toBe('numeric-date');
    expect(match.date.getFullYear()).toBe(2026);
    expect(match.date.getMonth()).toBe(2);
  });
});

describe('bare day-of-month', () => {
  // base 2026-07-19
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('아직 안 지난 날은 이번 달', () => {
    const match = parseDates('24일 마감', base)[0];
    expect(match.kind).toBe('day-only');
    expect(match.date.getMonth()).toBe(6); // 7월
    expect(match.date.getDate()).toBe(24);
  });

  it('오늘 이하 날짜(당일 포함)는 다음 달', () => {
    expect(parseDates('15일 결제', base)[0].date.getMonth()).toBe(7); // 8월
    expect(parseDates('19일 회의', base)[0].date.getMonth()).toBe(7); // 오늘=다음달
  });

  it('시각을 함께 인식한다', () => {
    const match = parseDates('24일 3시 미팅', base)[0];
    expect(match.date.getDate()).toBe(24);
    expect(match.date.getHours()).toBe(15);
    expect(match.hasTime).toBe(true);
  });

  it('기간·순번 표현은 날짜가 아니다', () => {
    expect(parseDates('10일 정도 걸림', base)).toHaveLength(0);
    expect(parseDates('3일간 여행', base)).toHaveLength(0);
    expect(parseDates('3일째 되는 날', base)).toHaveLength(0);
    expect(parseDates('3일 후', base)[0].kind).toBe('n-days-later');
  });

  it('N월 N일 안의 일자를 중복 인식하지 않는다', () => {
    const matches = parseDates('3월 6일 발표', base);
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('month-day-kr');
  });

  it('그 달에 없는 날짜는 무시한다', () => {
    // 2026-01-31 기준 "31일" → 오늘=다음달(2월)인데 2월 31일 없음 → 무시
    const janBase = new Date(2026, 0, 31, 10, 0, 0).getTime();
    expect(parseDates('31일 결산', janBase)).toHaveLength(0);
  });
});

describe('native-Korean day counts', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime(); // 2026-07-19

  it('순우리말 셈 + 후/뒤를 인식한다', () => {
    expect(parseDates('열흘 뒤 여행', base)[0].date.getDate()).toBe(29);
    expect(parseDates('보름 후 결산', base)[0]).toMatchObject({ text: '보름 후' });
    expect(parseDates('사흘 뒤', base)[0].date.getDate()).toBe(22);
    expect(parseDates('스무날 후', base)[0].date.getDate()).toBe(8); // 8월 8일
  });

  it('일주일/이주일 후를 인식한다', () => {
    expect(parseDates('일주일 후 점검', base)[0].date.getDate()).toBe(26);
    expect(parseDates('이주일 뒤에 확인', base)[0].date.getDate()).toBe(2); // 8월 2일
  });

  it('후/뒤 없이 단독으로 쓰면 인식하지 않는다', () => {
    expect(parseDates('보름달이 떴다', base)).toHaveLength(0);
    expect(parseDates('열흘간 여행', base)).toHaveLength(0);
  });
});

describe('weekday josa and word boundaries', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('요일 뒤 조사를 인식한다', () => {
    expect(parseDates('다음주 월요일까지 제출', base)[0].text).toBe('다음주 월요일');
    expect(parseDates('금요일부터 연휴', base)[0].date.getDate()).toBe(24);
    expect(parseDates('토요일마다 운동', base)[0].date.getDate()).toBe(25);
  });

  it('한 글자 요일이 다른 단어에 붙으면 제외한다', () => {
    for (const word of ['월급 235만원', '수업 준비', '금액 확인', '화장실 청소', '토지 매매', '금방 갈게']) {
      expect(parseDates(word, base)).toHaveLength(0);
    }
  });
});

describe('past relatives', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('그저께를 인식한다', () => {
    expect(parseDates('그저께 통화', base)[0].date.getDate()).toBe(17);
  });

  it('그제서야 같은 단어는 인식하지 않는다', () => {
    expect(parseDates('그제서야 알았다', base)).toHaveLength(0);
  });
});

describe('false-positive boundaries (real text)', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('숫자+단위/식별자는 날짜가 아니다', () => {
    for (const text of [
      '몸무게 65.5 기록',
      '전화 010-1234',
      '회의실 302호',
      '12명 참석',
      '3시간짜리 작업',
      '진도 3.5 지진',
    ]) {
      expect(parseDates(text, base)).toHaveLength(0);
    }
  });
});

describe('explicit dates', () => {
  const base = new Date(2026, 6, 19, 10, 0, 0).getTime();

  it('연도가 명시되면 그대로 존중한다', () => {
    const match = parseDates('2025년 7월 20일 회고', base)[0];
    expect(match.date.getFullYear()).toBe(2025);
    expect(match.date.getMonth()).toBe(6);
    expect(match.date.getDate()).toBe(20);
  });

  it('과거 월일은 내년으로 넘긴다', () => {
    const match = parseDates('3월 6일 발표', base)[0];
    expect(match.date.getFullYear()).toBe(2027);
  });

  it('내년으로 넘길 수 없는 2월 29일은 무시한다', () => {
    const leapBase = new Date(2028, 2, 1).getTime(); // 2028-03-01, 2029는 평년
    expect(parseDates('2월 29일 행사', leapBase)).toHaveLength(0);
  });
});
