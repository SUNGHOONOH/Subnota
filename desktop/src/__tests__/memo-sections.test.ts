import { describe, expect, it } from 'vitest';

import { getSections } from '../lib/memoSections';
import { MemoRow } from '../types';

const memo = (id: string, updatedAt: string): MemoRow => ({
  category: 'default',
  content: id,
  content_hash: null,
  content_updated_at: updatedAt,
  created_at: updatedAt,
  id,
  is_archived: false,
  synced_content_hash: null,
  updated_at: updatedAt,
});

describe('getSections', () => {
  const now = new Date().toISOString();
  const memos = [memo('a', now), memo('b', now), memo('c', now), memo('d', now)];

  it('keeps existing grouping when nothing is pinned', () => {
    const sections = getSections(memos);
    expect(sections[0].title).toBe('최근 메모');
    expect(sections[0].data.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts pinned memos first, in pin order, and out of the date groups', () => {
    const sections = getSections(memos, ['c', 'a']);
    expect(sections[0].title).toBe('고정됨');
    expect(sections[0].data.map(item => item.id)).toEqual(['c', 'a']);
    const rest = sections.slice(1).flatMap(section => section.data.map(item => item.id));
    expect(rest).toEqual(['b', 'd']);
  });

  it('ignores pinned ids that no longer resolve to a memo', () => {
    const sections = getSections(memos, ['ghost']);
    expect(sections[0].title).toBe('최근 메모');
  });

  it('places mini memos in their own section right after 최근 메모', () => {
    const mini = [memo('m1', now), memo('m2', now)];
    const sections = getSections(memos, [], mini);

    expect(sections.map(section => section.title)).toEqual([
      '최근 메모',
      'Mini 노트',
      '오늘',
    ]);
    expect(sections[1].data.map(item => item.id)).toEqual(['m1', 'm2']);
    // 미니는 날짜 그룹에 다시 나타나지 않는다.
    expect(sections[2].data.map(item => item.id)).toEqual(['d']);
  });

  it('pins a mini memo into 고정됨 and drops it from the mini section', () => {
    const mini = [memo('m1', now), memo('m2', now)];
    const sections = getSections(memos, ['m1'], mini);

    expect(sections[0].title).toBe('고정됨');
    expect(sections[0].data.map(item => item.id)).toEqual(['m1']);
    const miniSection = sections.find(section => section.title === 'Mini 노트');
    expect(miniSection?.data.map(item => item.id)).toEqual(['m2']);
  });
});
