import { describe, expect, it } from 'vitest';

import {
  buildMonthlyReport,
  hasKnowledgeSection,
  hasTopicSection,
  monthMeta,
  reportMonthKey,
  shiftMonthKey,
} from '../features/report/monthlyReport';
import type { MemoRow, TopicCluster, TopicMembership } from '../types';
import type { ActivityCompletion } from '../features/report/growthTypes';

const memo = (id: string, createdAt: string, content = 'x'): MemoRow =>
  ({
    id,
    content,
    content_hash: null,
    created_at: createdAt,
    is_archived: false,
    updated_at: createdAt,
  }) as MemoRow;

const activity = (localDate: string, id: string): ActivityCompletion => ({
  id,
  calendar_block_id: `b-${id}`,
  completed_at: `${localDate}T10:00:00`,
  local_date: localDate,
});

const cluster = (id: string, label: string): TopicCluster => ({
  confidence: 1,
  id,
  keywords: [],
  label,
  memoCount: 0,
  representativeMemoIds: [],
});

const membership = (memoId: string, topicId: string): TopicMembership => ({
  memoId,
  score: 1,
  topicId,
});

const empty = {
  memos: [],
  activities: [],
  clusters: [],
  memberships: [],
  edges: [],
};

describe('month keys', () => {
  it('리포트는 직전 달을 가리킨다', () => {
    expect(reportMonthKey(new Date(2026, 7, 3))).toBe('2026-07');
    expect(reportMonthKey(new Date(2026, 0, 3))).toBe('2025-12');
  });

  it('월 이동은 연도를 넘긴다', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });

  it('달의 길이와 첫 요일을 준다', () => {
    // 2026-07-01은 수요일, 31일까지
    expect(monthMeta('2026-07')).toEqual({ daysInMonth: 31, firstWeekday: 3 });
    expect(monthMeta('2026-02').daysInMonth).toBe(28);
  });
});

describe('잔디 (일별 활동량)', () => {
  it('그날 쓴 메모와 완료한 일정을 합산한다', () => {
    const report = buildMonthlyReport(
      {
        ...empty,
        memos: [
          memo('a', '2026-07-02T09:00:00'),
          memo('b', '2026-07-02T18:00:00'),
          memo('c', '2026-06-30T09:00:00'),
        ],
        activities: [activity('2026-07-02', '1'), activity('2026-07-10', '2')],
      },
      '2026-07',
    );

    expect(report.dailyCounts).toHaveLength(31);
    expect(report.dailyCounts[1]).toBe(3); // 2일: 메모 2 + 완료 1
    expect(report.dailyCounts[9]).toBe(1); // 10일
    expect(report.dailyCounts[0]).toBe(0);
  });

  it('기록한 날은 메모나 완료가 하나라도 있는 날이다', () => {
    const report = buildMonthlyReport(
      {
        ...empty,
        memos: [memo('a', '2026-07-02T09:00:00')],
        activities: [activity('2026-07-05', '1'), activity('2026-07-05', '2')],
      },
      '2026-07',
    );

    expect(report.activeDays).toBe(2);
  });
});

describe('지난달 대비', () => {
  const input = {
    ...empty,
    memos: [
      memo('j1', '2026-06-05T09:00:00'),
      memo('j2', '2026-06-06T09:00:00'),
      memo('k1', '2026-07-05T09:00:00'),
      memo('k2', '2026-07-06T09:00:00'),
      memo('k3', '2026-07-07T09:00:00'),
    ],
    activities: [activity('2026-06-05', '1'), activity('2026-07-05', '2')],
  };

  it('메모·완료·기록한 날 증감을 계산한다', () => {
    const report = buildMonthlyReport(input, '2026-07');
    expect(report.memoCount).toBe(3);
    expect(report.memoDelta).toBe(1);
    expect(report.completedDelta).toBe(0);
    expect(report.activeDays).toBe(3);
    expect(report.activeDaysDelta).toBe(1);
  });
});

describe('대표 주제', () => {
  const base = {
    ...empty,
    memos: [
      memo('old1', '2026-06-01T09:00:00'),
      memo('old2', '2026-06-02T09:00:00'),
      memo('a1', '2026-07-01T09:00:00'),
      memo('a2', '2026-07-02T09:00:00'),
      memo('b1', '2026-07-03T09:00:00'),
    ],
    clusters: [cluster('t1', '결제 연동'), cluster('t2', '회고 시스템')],
    memberships: [
      membership('old1', 't1'),
      membership('old2', 't1'),
      membership('a1', 't1'),
      membership('a2', 't1'),
      membership('b1', 't2'),
    ],
  };

  it('이번 달 메모 수 순으로 3개까지 준다', () => {
    const report = buildMonthlyReport(base, '2026-07');
    expect(report.topics).toHaveLength(2);
    expect(report.topics[0]).toMatchObject({
      label: '결제 연동',
      current: 2,
      previous: 2,
      isNew: false,
    });
  });

  it('이번 달 처음 생긴 주제는 isNew', () => {
    const report = buildMonthlyReport(base, '2026-07');
    expect(report.topics[1]).toMatchObject({ label: '회고 시스템', isNew: true });
    expect(report.newTopics).toEqual(['회고 시스템']);
  });

  it('주제가 2개 미만이면 섹션을 숨긴다', () => {
    const report = buildMonthlyReport(
      {
        ...empty,
        memos: [memo('a1', '2026-07-01T09:00:00')],
        clusters: [cluster('t1', '결제 연동')],
        memberships: [membership('a1', 't1')],
      },
      '2026-07',
    );
    expect(hasTopicSection(report)).toBe(false);
  });
});

describe('넓어진 지식', () => {
  it('이번 달 메모가 걸린 연결을 증가분으로 센다', () => {
    const report = buildMonthlyReport(
      {
        ...empty,
        memos: [
          memo('hub', '2026-07-01T09:00:00', '허브 노트\n본문'),
          memo('x', '2026-07-02T09:00:00'),
          memo('old', '2026-01-02T09:00:00'),
        ],
        edges: [
          { similarity: 1, sourceMemoId: 'hub', sourceTopicId: null, targetMemoId: 'x', targetTopicId: null },
          { similarity: 1, sourceMemoId: 'hub', sourceTopicId: null, targetMemoId: 'old', targetTopicId: null },
          { similarity: 1, sourceMemoId: 'old', sourceTopicId: null, targetMemoId: 'old', targetTopicId: null },
        ],
      },
      '2026-07',
    );

    expect(report.newEdgeCount).toBe(2);
    expect(report.totalEdgeCount).toBe(3);
    expect(hasKnowledgeSection(report)).toBe(true);
  });

  it('연결도 새 주제도 없으면 섹션을 숨긴다', () => {
    expect(hasKnowledgeSection(buildMonthlyReport(empty, '2026-07'))).toBe(false);
  });
});

describe('대표 메모', () => {
  it('연결이 가장 많은 이번 달 메모와 연결 수를 준다', () => {
    const report = buildMonthlyReport(
      {
        ...empty,
        memos: [
          memo('hub', '2026-07-01T09:00:00', '허브 노트\n본문'),
          memo('x', '2026-07-02T09:00:00'),
          memo('y', '2026-07-03T09:00:00'),
        ],
        edges: [
          { similarity: 1, sourceMemoId: 'hub', sourceTopicId: null, targetMemoId: 'x', targetTopicId: null },
          { similarity: 1, sourceMemoId: 'hub', sourceTopicId: null, targetMemoId: 'y', targetTopicId: null },
        ],
      },
      '2026-07',
    );

    expect(report.hubMemo).toMatchObject({ title: '허브 노트', degree: 2 });
  });

  it('연결이 없으면 null', () => {
    expect(buildMonthlyReport(empty, '2026-07').hubMemo).toBeNull();
  });
});
