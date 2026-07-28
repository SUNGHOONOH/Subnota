import { describe, expect, it } from 'vitest';

import { formatRelativeDay } from '../lib/relativeDay';

const at = (iso: string) => new Date(iso).getTime();

describe('formatRelativeDay', () => {
  const now = at('2026-07-25T14:00:00');

  it('오늘·어제는 날짜 수가 아니라 이름으로 부른다', () => {
    expect(formatRelativeDay(at('2026-07-25T09:00:00'), now)).toBe('오늘');
    expect(formatRelativeDay(at('2026-07-24T23:30:00'), now)).toBe('어제');
  });

  // 22시간 전이지만 달력으로는 어제다. 경과 시간으로 세면 "오늘"이 되어
  // 실제 감각과 어긋난다.
  it('경과 시간이 아니라 달력 날짜로 센다', () => {
    expect(formatRelativeDay(at('2026-07-24T16:00:00'), now)).toBe('어제');
  });

  it('7일까지는 날짜로, 8일부터 주 단위로 접는다', () => {
    expect(formatRelativeDay(at('2026-07-18T10:00:00'), now)).toBe('7일 전');
    expect(formatRelativeDay(at('2026-07-17T10:00:00'), now)).toBe('1주 전');
  });

  it('주·개월·년 단위로 접는다', () => {
    expect(formatRelativeDay(at('2026-07-19T10:00:00'), now)).toBe('6일 전');
    expect(formatRelativeDay(at('2026-07-11T10:00:00'), now)).toBe('2주 전');
    expect(formatRelativeDay(at('2026-05-01T10:00:00'), now)).toBe('2개월 전');
    expect(formatRelativeDay(at('2024-07-25T10:00:00'), now)).toBe('2년 전');
  });

  it('값이 없거나 미래면 빈 문자열', () => {
    expect(formatRelativeDay(null, now)).toBe('');
    expect(formatRelativeDay(undefined, now)).toBe('');
    expect(formatRelativeDay(Number.NaN, now)).toBe('');
    expect(formatRelativeDay(at('2026-07-26T10:00:00'), now)).toBe('');
  });
});
