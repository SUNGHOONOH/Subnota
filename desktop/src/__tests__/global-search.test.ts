import { describe, expect, it } from 'vitest';

import {
  buildGlobalSearchCatalog,
  buildGlobalSearchItems,
} from '../lib/globalSearch';
import type { InboxSession } from '../services/backend/inboxService';
import type { CalendarBlockRow, MemoRow, TopicCluster } from '../types';

const memo = {
  category: 'Ideas',
  content: '# 출시 계획\nWindows 베타 준비',
  content_hash: null,
  created_at: '2026-07-01T00:00:00.000Z',
  id: 'memo-1',
  is_archived: false,
  updated_at: '2026-07-20T00:00:00.000Z',
} satisfies MemoRow;

const topic = {
  confidence: 0.9,
  id: 'topic-1',
  keywords: ['배포', '업데이트'],
  label: '데스크톱 출시',
  memoCount: 3,
  representativeMemoIds: ['memo-1'],
} satisfies TopicCluster;

const calendarBlock = {
  all_day: true,
  color: null,
  completed_at: null,
  created_at: '2026-07-01T00:00:00.000Z',
  end_date: null,
  id: 'calendar-1',
  is_completed: false,
  note: '체크리스트 확인',
  order: null,
  start_date: '2026-07-25T00:00:00.000Z',
  title: 'Windows 테스트',
  updated_at: '2026-07-01T00:00:00.000Z',
} satisfies CalendarBlockRow;

const inboxItem = {
  canonicalUrl: 'https://example.com',
  channelTitle: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  description: '사이드바 디자인 사례',
  domain: 'example.com',
  duration: null,
  id: 'inbox-1',
  keywords: ['인터페이스'],
  liked: false,
  originalUrl: 'https://example.com',
  publishedAt: null,
  selectedText: null,
  sourceType: 'url',
  summary: null,
  summaryBasis: null,
  summaryDetail: null,
  summaryOneLiner: null,
  summaryProvider: null,
  summarySearchText: null,
  summaryStatus: 'ready',
  thumbnailUrl: null,
  title: '생산성 앱 탐색 구조',
  userNote: null,
} satisfies InboxSession;

const makeCatalog = () => {
  const items = buildGlobalSearchItems({
    calendarBlocks: [calendarBlock],
    inboxItems: [inboxItem],
    memos: [memo],
    scheduleInbox: [],
    topicClusters: [topic],
  });
  return buildGlobalSearchCatalog(items);
};

describe('global search', () => {
  it('finds items across memo, topic, inbox, and calendar sources', () => {
    const catalog = makeCatalog();

    expect(catalog.search('베타')[0]?.key).toBe('memo:memo-1');
    expect(catalog.search('업데이트')[0]?.key).toBe('topic:topic-1');
    expect(catalog.search('사이드바')[0]?.key).toBe('inbox:inbox-1');
    expect(catalog.search('체크리스트')[0]?.key).toBe('calendar:calendar-1');
  });

  it('shows timestamped items in newest-first order for an empty query', () => {
    expect(makeCatalog().search('').map(item => item.key)).toEqual([
      'calendar:calendar-1',
      'inbox:inbox-1',
      'memo:memo-1',
    ]);
  });

  it('does not crash when a refresh briefly supplies the same item twice', () => {
    const items = buildGlobalSearchItems({
      calendarBlocks: [],
      inboxItems: [inboxItem, inboxItem],
      memos: [],
      scheduleInbox: [],
      topicClusters: [],
    });

    const catalog = buildGlobalSearchCatalog(items);
    expect(catalog.search('사이드바').map(item => item.key)).toEqual([
      'inbox:inbox-1',
    ]);
  });
});
