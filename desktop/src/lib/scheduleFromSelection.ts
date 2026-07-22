import { parseDates } from './dateParser';

export interface SelectionSchedule {
  allDay: boolean;
  date: Date | null;
  title: string;
}

// 선택 문장에서 일정 제목/날짜를 뽑는다. 날짜 표현("7월 25일 오후 2시")은
// 제목에서 제거하고, 인식 실패 시 date=null(사용자가 날짜를 직접 선택).
export const buildScheduleFromSelection = (
  selectedText: string,
  now = Date.now(),
): SelectionSchedule => {
  const text = selectedText.trim();
  const match = parseDates(text, now)[0] ?? null;

  if (!match) {
    return { allDay: true, date: null, title: text };
  }

  // match.index 위치를 직접 잘라낸다 — replace(match.text)는 같은 문자열이
  // 앞에 또 있으면 엉뚱한 곳을 지운다.
  const title =
    (text.slice(0, match.index) + ' ' + text.slice(match.index + match.length))
      .replace(/\s+/g, ' ')
      .trim() || text;

  return {
    allDay: !match.hasTime,
    date: match.date,
    title,
  };
};

const MEMO_NOTE_LINK_PATTERN = /(?:^|\n+)원본 노트:\s*memo:([A-Za-z0-9_-]+)\s*$/;

// 일정 메모(note) 끝에 원본 노트 참조를 남겨 캘린더에서 되돌아올 수 있게 한다.
// 별도 컬럼 없이 기존 note 필드만 사용한다.
export const buildScheduleNote = (
  selectedText: string,
  memoId?: string | null,
) => (memoId ? `${selectedText}\n\n원본 노트: memo:${memoId}` : selectedText);

export const parseScheduleNoteMemoId = (note: string | null | undefined) =>
  note?.match(MEMO_NOTE_LINK_PATTERN)?.[1] ?? null;

// 일정 편집 화면에는 사용자가 작성한 메모만 보여주고, 원본 노트 참조는
// 캘린더에서 노트를 다시 여는 데만 사용한다.
export const getScheduleNoteText = (note: string | null | undefined) =>
  note?.replace(MEMO_NOTE_LINK_PATTERN, '').trim() ?? '';
