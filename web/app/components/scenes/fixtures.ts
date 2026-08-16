/* 화면에 쓰는 결정적 데이터. 백엔드도, 임베딩도, DB도 여기서 돌지 않는다 —
   실제 앱과 같은 구조의 고정값으로 화면 흐름만 재현한다. */

import type { MemoRow } from '../../subnota-ui/AppShell';
import type { CalDay, CalEvent, CalTone, MonthCell } from '../../subnota-ui/Calendar';
import type { InboxItem } from '../../subnota-ui/Inbox';

export const MEMOS: MemoRow[] = [
  { id: 'm1', title: '팀 회의 준비', preview: '다음 회의 전에 질문을 정리해야겠다' },
  { id: 'm2', title: '주간 회고', preview: '이번 주에 놓친 것 세 가지' },
  { id: 'm3', title: '읽을거리', preview: '검색 UX 관련 글 모음' },
  { id: 'm4', title: '가평 펜션', preview: '주말 여행 예약 확인하기' },
];

export const CAL_DAYS: CalDay[] = [
  { dow: '일', date: 9 },
  { dow: '월', date: 10 },
  { dow: '화', date: 11 },
  { dow: '수', date: 12, today: true },
  { dow: '목', date: 13 },
  { dow: '금', date: 14 },
  { dow: '토', date: 15 },
];

export const CAL_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

export const BASE_EVENTS: CalEvent[] = [
  {
    day: 1,
    durationHours: 1,
    id: 'e1',
    startHour: 10,
    time: '오전 10:00',
    title: '스탠드업',
    tone: 'green',
  },
  {
    day: 4,
    durationHours: 1.5,
    id: 'e2',
    startHour: 13,
    time: '오후 1:00',
    title: '디자인 리뷰',
    tone: 'blue',
  },
];

/* 챕터 2가 만들어 내는 일정. 문장에서 감지된 "내일 오후 3시"가 여기 앉는다. */
export const PLACED_EVENT: CalEvent = {
  day: 4,
  durationHours: 1,
  id: 'e-new',
  startHour: 15,
  time: '오후 3:00',
  title: '팀 미팅',
  tone: 'clay',
};

export const INBOX_ITEMS: InboxItem[] = [
  {
    excerpt:
      '검색 결과를 목록으로 던져 주는 대신, 사용자가 지금 하고 있는 일 옆에 필요한 것만 조용히 놓아 두는 방식에 관하여.',
    id: 'i1',
    keywords: ['검색 UX', '맥락', '인터페이스'],
    source: 'nngroup.com',
    summary: '검색을 별도 화면이 아니라 작업 흐름 안에 두는 사례들을 정리한 글.',
    title: '맥락 안에서 검색하기 — 결과 목록을 넘어서',
  },
  {
    duration: '14:22',
    excerpt:
      '회의를 짧게 만드는 것보다 회의 전에 무엇을 정리해 두는지가 더 큰 차이를 만든다는 이야기.',
    id: 'i2',
    keywords: ['회의', '준비', '팀'],
    source: 'YouTube',
    summary: '회의 전 준비 문서 하나가 회의 시간을 절반으로 줄인 팀의 기록.',
    title: '회의 전에 30분을 쓰면 회의가 절반이 된다',
  },
  {
    excerpt: '노트를 다시 읽게 만드는 것은 정리가 아니라 마주침이다.',
    id: 'i3',
    keywords: ['노트', '다시 읽기'],
    source: 'subnota.com',
    summary: '적어 둔 것을 다시 만나게 하는 방법에 대한 짧은 글.',
    title: '다시 읽히는 노트의 조건',
  },
];


/* ── 챕터 2 조각용 ── */

type StripRow = {
  label: string;
  date: string;
  blocks: { at: number; span: number; title: string; sub?: string; tone: CalTone }[];
};

export const WEEK_ROWS: StripRow[] = [
  { blocks: [], date: '8.16', label: '토' },
  {
    blocks: [
      { at: 3, span: 1, sub: '꽃바구니 예약', title: '생신', tone: 'clay' },
      { at: 4, span: 1, sub: '한정식 집', title: '식사', tone: 'blue' },
    ],
    date: '8.17',
    label: '일',
  },
];

export const WEEK_ROWS_PLACED: StripRow[] = [
  {
    blocks: [{ at: 3, span: 1, sub: '15:00', title: '팀 미팅', tone: 'green' }],
    date: '8.16',
    label: '토',
  },
  WEEK_ROWS[1],
];

const blank = (count: number, from: number): MonthCell[] =>
  Array.from({ length: count }, (_, index) => ({
    day: from + index,
    muted: true,
  }));

const week = (start: number, extras: Record<number, MonthCell['items']> = {}, today?: number): MonthCell[] =>
  Array.from({ length: 7 }, (_, index) => ({
    day: start + index,
    items: extras[start + index],
    today: today === start + index,
  }));

export const MONTH_CELLS: MonthCell[] = [
  ...week(9),
  ...week(16, {}, undefined),
  ...blank(7, 23),
];

export const MONTH_CELLS_PLACED: MonthCell[] = [
  ...week(9),
  ...week(16, {
    16: [{ title: '15:00 팀 미팅', tone: 'green' }],
    17: [
      { title: '엄마 생신', tone: 'clay' },
      { title: '가족 식사', tone: 'blue' },
    ],
  }),
  ...blank(7, 23),
];
