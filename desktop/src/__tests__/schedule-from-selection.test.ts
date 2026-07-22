import { describe, expect, it } from 'vitest';
import {
  buildScheduleFromSelection,
  buildScheduleNote,
  getScheduleNoteText,
  parseScheduleNoteMemoId,
} from '../lib/scheduleFromSelection';

const NOW = new Date('2026-07-19T09:00:00').getTime();

describe('buildScheduleFromSelection', () => {
  it('날짜·시간을 인식하고 제목에서 제거한다', () => {
    const schedule = buildScheduleFromSelection('7월 25일 오후 2시 팀 회의', NOW);

    expect(schedule.date).not.toBeNull();
    expect(schedule.date?.getMonth()).toBe(6);
    expect(schedule.date?.getDate()).toBe(25);
    expect(schedule.date?.getHours()).toBe(14);
    expect(schedule.allDay).toBe(false);
    expect(schedule.title).toBe('팀 회의');
  });

  it('시간이 없으면 종일 일정이다', () => {
    const schedule = buildScheduleFromSelection('7월 25일 워크샵', NOW);

    expect(schedule.date?.getDate()).toBe(25);
    expect(schedule.allDay).toBe(true);
    expect(schedule.title).toBe('워크샵');
  });

  it('24:00 일정은 종일이 아니라 익일 자정 시각 일정이다', () => {
    const schedule = buildScheduleFromSelection('오늘 24:00 마감', NOW);

    expect(schedule.date?.getDate()).toBe(20);
    expect(schedule.date?.getHours()).toBe(0);
    expect(schedule.allDay).toBe(false);
    expect(schedule.title).toBe('마감');
  });

  it('날짜 미인식 시 date=null, 제목은 전체 텍스트', () => {
    const schedule = buildScheduleFromSelection('디자인 리뷰 준비', NOW);

    expect(schedule.date).toBeNull();
    expect(schedule.title).toBe('디자인 리뷰 준비');
  });
});

describe('schedule note memo link', () => {
  it('memoId를 note에 저장하고 다시 읽는다', () => {
    const note = buildScheduleNote('7월 25일 팀 회의', 'memo-abc-123');
    expect(parseScheduleNoteMemoId(note)).toBe('memo-abc-123');
  });

  it('memoId가 없으면 원문 그대로', () => {
    const note = buildScheduleNote('팀 회의', null);
    expect(note).toBe('팀 회의');
    expect(parseScheduleNoteMemoId(note)).toBeNull();
  });

  it('편집 화면에는 원본 노트 내부 참조를 표시하지 않는다', () => {
    const note = buildScheduleNote('팀 회의 메모', 'memo-abc-123');

    expect(getScheduleNoteText(note)).toBe('팀 회의 메모');
    expect(getScheduleNoteText('원본 노트: memo:memo-abc-123')).toBe('');
  });
});
