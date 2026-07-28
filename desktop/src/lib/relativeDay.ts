/**
 * "7일 전"처럼 메모의 나이를 사람이 읽는 형태로.
 *
 * Ambient 추천에서 접두사로 쓴다. 이 접두사가 있어야 추천이 "내가 이어서
 * 쓸 문장"이 아니라 "예전에 쓴 다른 문장"으로 읽힌다 — Cursor의 고스트
 * 텍스트처럼 보이면서도 삽입 가능하다는 오해를 만들지 않는 장치다.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const formatRelativeDay = (
  timestamp: number | null | undefined,
  now: number = Date.now(),
): string => {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return '';
  }

  // 달력 기준으로 센다. 어제 23시에 쓴 메모는 22시간 전이어도 "어제"다.
  const startOfDay = (value: number) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / MS_PER_DAY);

  if (days < 0) return '';
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  // 7일까지는 "7일 전"으로 센다. 일주일은 아직 날짜로 세는 감각이라
  // "1주 전"보다 구체적이고, 8일부터 주 단위로 접는다.
  if (days <= 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
};
