import MiniSearch from 'minisearch';

import type { InboxSession } from '../services/backend/inboxService';
import type {
  CalendarBlockRow,
  MemoRow,
  ScheduleInboxRow,
  TopicCluster,
} from '../types';

export type GlobalSearchKind =
  | 'calendar'
  | 'inbox'
  | 'memo'
  | 'schedule'
  | 'topic';

export interface GlobalSearchItem {
  id: string;
  key: string;
  kind: GlobalSearchKind;
  searchText: string;
  subtitle: string;
  timestamp: number;
  title: string;
}

interface GlobalSearchSources {
  calendarBlocks: CalendarBlockRow[];
  inboxItems: InboxSession[];
  memos: MemoRow[];
  scheduleInbox: ScheduleInboxRow[];
  topicClusters: TopicCluster[];
}

const toTimestamp = (value: string | null | undefined) => {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const cleanLine = (value: string) => value.replace(/^#{1,6}\s+/, '').trim();

const memoTitleAndSubtitle = (content: string) => {
  const lines = content.split('\n').map(cleanLine).filter(Boolean);
  return {
    subtitle: lines.slice(1).join(' ').slice(0, 180) || '내용 없음',
    title: lines[0] || '새 메모',
  };
};

export const buildGlobalSearchItems = ({
  calendarBlocks,
  inboxItems,
  memos,
  scheduleInbox,
  topicClusters,
}: GlobalSearchSources): GlobalSearchItem[] => [
  ...memos.map(memo => {
    const { subtitle, title } = memoTitleAndSubtitle(memo.content);
    return {
      id: memo.id,
      key: `memo:${memo.id}`,
      kind: 'memo' as const,
      searchText: `${memo.content} ${memo.category ?? ''}`,
      subtitle,
      timestamp: toTimestamp(memo.updated_at),
      title,
    };
  }),
  ...topicClusters.map(topic => ({
    id: topic.id,
    key: `topic:${topic.id}`,
    kind: 'topic' as const,
    searchText: `${topic.label} ${topic.keywords.join(' ')}`,
    subtitle: topic.keywords.join(' · ') || `${topic.memoCount}개의 메모`,
    timestamp: 0,
    title: topic.label,
  })),
  ...inboxItems.map(item => ({
    id: item.id,
    key: `inbox:${item.id}`,
    kind: 'inbox' as const,
    searchText: [
      item.title,
      item.domain,
      item.description,
      item.summary,
      item.summaryOneLiner,
      item.summarySearchText,
      item.userNote,
      ...item.keywords,
    ]
      .filter(Boolean)
      .join(' '),
    subtitle:
      item.summaryOneLiner ??
      item.description ??
      item.summary ??
      item.domain ??
      '링크 저장함',
    timestamp: toTimestamp(item.createdAt),
    title: item.title ?? item.domain ?? '제목 없는 수집 항목',
  })),
  ...calendarBlocks.map(block => ({
    id: block.id,
    key: `calendar:${block.id}`,
    kind: 'calendar' as const,
    searchText: `${block.title} ${block.note ?? ''}`,
    subtitle: block.note?.trim() || '캘린더 일정',
    timestamp: toTimestamp(block.start_date),
    title: block.title,
  })),
  ...scheduleInbox.map(item => ({
    id: item.id,
    key: `schedule:${item.id}`,
    kind: 'schedule' as const,
    searchText: `${item.title} ${item.source_text} ${item.time_text ?? ''}`,
    subtitle: item.source_text || '일정 후보',
    timestamp: toTimestamp(item.scheduled_at ?? item.created_at),
    title: item.title,
  })),
];

export const buildGlobalSearchCatalog = (items: GlobalSearchItem[]) => {
  // Refresh and local-first merge can briefly contain the same Inbox row twice
  // while a server response and a queued local row settle. MiniSearch requires
  // unique idField values; duplicate input must not take down the whole app.
  const seenKeys = new Set<string>();
  const uniqueItems = items.filter(item => {
    if (seenKeys.has(item.key)) return false;
    seenKeys.add(item.key);
    return true;
  });
  const index = new MiniSearch({
    fields: ['title', 'subtitle', 'searchText'],
    idField: 'key',
  });
  const itemsByKey = new Map(uniqueItems.map(item => [item.key, item]));

  index.addAll(uniqueItems);

  return {
    search(query: string, limit = 20) {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return uniqueItems
          .filter(item => item.timestamp > 0)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      }

      return index
        .search(normalizedQuery, {
          boost: { subtitle: 1.4, title: 3 },
          fuzzy: normalizedQuery.length > 2 ? 0.2 : false,
          prefix: true,
        })
        .slice(0, limit)
        .map(result => itemsByKey.get(String(result.id)))
        .filter((item): item is GlobalSearchItem => Boolean(item));
    },
  };
};
